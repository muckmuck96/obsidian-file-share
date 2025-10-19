import { FileRequestQueue } from '../../src/core/FileRequestQueue';
import { TFile } from 'obsidian';
import { IFriend } from '../../src/interfaces/IFriend';
import { IFileRequest } from '../../src/interfaces/IFileRequest';

// Mock crypto.randomUUID
if (typeof global.crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: jest.fn(() => `mock-uuid-${Math.random()}`),
  };
}

const createMockPlugin = () => {
  return {
    secure: {
      signData: jest.fn((data: string) => `signature-of-${data}`),
    },
    socket: {
      send: jest.fn(),
    },
    settings: {},
  };
};

const createMockFile = (name: string, path: string = `/vault/${name}`): TFile => {
  const file = new TFile();
  file.name = name;
  file.path = path;
  file.extension = name.split('.').pop() || '';
  return file;
};

const createMockFriend = (username: string, publicKey: string = 'mock-public-key'): IFriend => {
  return {
    username,
    publicKey,
  };
};

describe('FileRequestQueue', () => {
  let queue: FileRequestQueue;
  let mockPlugin: any;
  let mockSendFileMethod: jest.Mock;
  let mockFile: TFile;
  let mockFriend: IFriend;

  beforeEach(() => {
    mockPlugin = createMockPlugin();
    mockSendFileMethod = jest.fn().mockResolvedValue(undefined);
    queue = new FileRequestQueue(mockSendFileMethod, mockPlugin);

    mockFile = createMockFile('test.md');
    mockFriend = createMockFriend('Alice');

    jest.clearAllMocks();
  });

  describe('addRequest', () => {
    it('should add a new request to the queue', () => {
      queue.addRequest(mockFile, mockFriend);

      const requests = queue.getRequestsByFile(mockFile);
      expect(requests.length).toBe(1);
      expect(requests[0].file).toBe(mockFile);
      expect(requests[0].recipient).toBe(mockFriend);
      expect(requests[0].state).toBe('pending');
      expect(requests[0].progress).toBe(0);
    });

    it('should generate a unique request ID', () => {
      queue.addRequest(mockFile, mockFriend);
      queue.addRequest(mockFile, mockFriend);

      const requests = queue.getRequestsByFile(mockFile);
      expect(requests.length).toBe(2);
      expect(requests[0].id).not.toBe(requests[1].id);
    });

    it('should send the file request via socket', () => {
      queue.addRequest(mockFile, mockFriend);

      expect(mockPlugin.socket.send).toHaveBeenCalledWith('request', {
        target: mockFriend.publicKey,
        filename: mockFile.name,
        signature: expect.any(String),
        id: expect.any(String),
        sourceFolderPath: undefined,
      });
    });

    it('should include sourceFolderPath when provided', () => {
      const sourcePath = 'folder/subfolder';
      queue.addRequest(mockFile, mockFriend, sourcePath);

      const requests = queue.getRequestsByFile(mockFile);
      expect(requests[0].sourceFolderPath).toBe(sourcePath);

      expect(mockPlugin.socket.send).toHaveBeenCalledWith('request', {
        target: mockFriend.publicKey,
        filename: mockFile.name,
        signature: expect.any(String),
        id: expect.any(String),
        sourceFolderPath: sourcePath,
      });
    });

    it('should sign the request data', () => {
      queue.addRequest(mockFile, mockFriend);

      expect(mockPlugin.secure.signData).toHaveBeenCalledWith(
        expect.stringContaining('"type":"request"')
      );
      expect(mockPlugin.secure.signData).toHaveBeenCalledWith(
        expect.stringContaining(mockFriend.publicKey)
      );
      expect(mockPlugin.secure.signData).toHaveBeenCalledWith(
        expect.stringContaining(mockFile.name)
      );
    });
  });

  describe('updateRequestState', () => {
    it('should update request state', () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.updateRequestState(requestId, 'accepted');

      const updatedRequests = queue.getRequestsByFile(mockFile);
      expect(updatedRequests[0].state).toBe('accepted');
    });

    it('should update request progress', () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.updateRequestState(requestId, 'sending', 50);

      const updatedRequests = queue.getRequestsByFile(mockFile);
      expect(updatedRequests[0].state).toBe('sending');
      expect(updatedRequests[0].progress).toBe(50);
    });

    it('should not throw error for non-existent request ID', () => {
      expect(() => {
        queue.updateRequestState('non-existent-id', 'completed');
      }).not.toThrow();
    });

    it('should update all possible states', () => {
      const states: Array<'pending' | 'accepted' | 'sending' | 'completed' | 'failed' | 'rejected'> = [
        'pending',
        'accepted',
        'sending',
        'completed',
        'failed',
        'rejected',
      ];

      states.forEach((state) => {
        queue.addRequest(mockFile, mockFriend);
        const requests = queue.getRequestsByFile(mockFile);
        const requestId = requests[requests.length - 1].id;

        queue.updateRequestState(requestId, state);

        const updatedRequests = queue.getRequestsByFile(mockFile);
        const updatedRequest = updatedRequests.find((r) => r.id === requestId);
        expect(updatedRequest?.state).toBe(state);
      });
    });
  });

  describe('getRequestByFileId', () => {
    it('should return request with matching fileId', () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      // Manually set fileId for testing
      queue.updateRequestState(requestId, 'pending');
      const request = queue.getRequestsByFile(mockFile)[0];
      (request as any).fileId = 'test-file-id';

      const found = queue.getRequestByFileId('test-file-id');
      expect(found).toBeDefined();
      expect(found?.id).toBe(requestId);
    });

    it('should return undefined when no matching fileId', () => {
      queue.addRequest(mockFile, mockFriend);

      const found = queue.getRequestByFileId('non-existent-file-id');
      expect(found).toBeUndefined();
    });
  });

  describe('getRequestsByFile', () => {
    it('should return all requests for a specific file', () => {
      const friend1 = createMockFriend('Alice');
      const friend2 = createMockFriend('Bob');

      queue.addRequest(mockFile, friend1);
      queue.addRequest(mockFile, friend2);

      const requests = queue.getRequestsByFile(mockFile);
      expect(requests.length).toBe(2);
    });

    it('should return empty array when no requests for file', () => {
      const otherFile = createMockFile('other.md', '/vault/other.md');

      queue.addRequest(mockFile, mockFriend);

      const requests = queue.getRequestsByFile(otherFile);
      expect(requests.length).toBe(0);
    });

    it('should filter requests by file path', () => {
      const file1 = createMockFile('file1.md', '/vault/file1.md');
      const file2 = createMockFile('file2.md', '/vault/file2.md');

      queue.addRequest(file1, mockFriend);
      queue.addRequest(file2, mockFriend);

      const requests1 = queue.getRequestsByFile(file1);
      const requests2 = queue.getRequestsByFile(file2);

      expect(requests1.length).toBe(1);
      expect(requests2.length).toBe(1);
      expect(requests1[0].file.path).toBe('/vault/file1.md');
      expect(requests2[0].file.path).toBe('/vault/file2.md');
    });
  });

  describe('handleResponse', () => {
    it('should handle accepted response and send file', async () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;
      const hash = 'test-hash';

      queue.handleResponse(requestId, true, hash);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSendFileMethod).toHaveBeenCalledWith(
        mockFile,
        mockFriend,
        hash,
        undefined
      );
    });

    it('should handle accepted response with sourceFolderPath', async () => {
      const sourcePath = 'folder/subfolder';
      queue.addRequest(mockFile, mockFriend, sourcePath);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;
      const hash = 'test-hash';

      queue.handleResponse(requestId, true, hash);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSendFileMethod).toHaveBeenCalledWith(
        mockFile,
        mockFriend,
        hash,
        sourcePath
      );
    });

    it('should update state to accepted before sending file', () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.handleResponse(requestId, true, 'test-hash');

      const updatedRequests = queue.getRequestsByFile(mockFile);
      expect(updatedRequests[0].state).toBe('accepted');
    });

    it('should update state to completed after successful send', async () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.handleResponse(requestId, true, 'test-hash');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updatedRequests = queue.getRequestsByFile(mockFile);
      expect(updatedRequests[0].state).toBe('completed');
      expect(updatedRequests[0].progress).toBe(100);
    });

    it('should update state to failed if send fails', async () => {
      mockSendFileMethod.mockRejectedValue(new Error('Send failed'));

      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.handleResponse(requestId, true, 'test-hash');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updatedRequests = queue.getRequestsByFile(mockFile);
      expect(updatedRequests[0].state).toBe('failed');
    });

    it('should handle rejected response', () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.handleResponse(requestId, false, 'test-hash');

      const updatedRequests = queue.getRequestsByFile(mockFile);
      expect(updatedRequests[0].state).toBe('rejected');
      expect(mockSendFileMethod).not.toHaveBeenCalled();
    });

    it('should clean up completed requests after delay', async () => {
      jest.useFakeTimers();

      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.handleResponse(requestId, true, 'test-hash');

      await Promise.resolve(); // Allow promise to resolve

      // Fast-forward time
      jest.advanceTimersByTime(3100);

      const remainingRequests = queue.getRequestsByFile(mockFile);
      expect(remainingRequests.length).toBe(0);

      jest.useRealTimers();
    });

    it('should clean up rejected requests after delay', () => {
      jest.useFakeTimers();

      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.handleResponse(requestId, false, 'test-hash');

      // Fast-forward time
      jest.advanceTimersByTime(3100);

      const remainingRequests = queue.getRequestsByFile(mockFile);
      expect(remainingRequests.length).toBe(0);

      jest.useRealTimers();
    });

    it('should clean up failed requests after longer delay', async () => {
      jest.useFakeTimers();
      mockSendFileMethod.mockRejectedValue(new Error('Send failed'));

      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      queue.handleResponse(requestId, true, 'test-hash');

      // Wait for the promise to reject and error handler to run
      await jest.runAllTicks();
      await Promise.resolve();

      // Fast-forward time (failed requests clean up after 5 seconds)
      jest.advanceTimersByTime(5100);

      const remainingRequests = queue.getRequestsByFile(mockFile);
      expect(remainingRequests.length).toBe(0);

      jest.useRealTimers();
    });

    it('should handle response for non-existent request gracefully', () => {
      expect(() => {
        queue.handleResponse('non-existent-id', true, 'test-hash');
      }).not.toThrow();

      expect(mockSendFileMethod).not.toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple concurrent requests', () => {
      const file1 = createMockFile('file1.md');
      const file2 = createMockFile('file2.md');
      const friend1 = createMockFriend('Alice');
      const friend2 = createMockFriend('Bob');

      queue.addRequest(file1, friend1);
      queue.addRequest(file1, friend2);
      queue.addRequest(file2, friend1);

      const requests1 = queue.getRequestsByFile(file1);
      const requests2 = queue.getRequestsByFile(file2);

      expect(requests1.length).toBe(2);
      expect(requests2.length).toBe(1);
    });

    it('should track request lifecycle from pending to completed', async () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      // Initial state
      expect(requests[0].state).toBe('pending');

      // Accept request
      queue.handleResponse(requestId, true, 'test-hash');
      let updated = queue.getRequestsByFile(mockFile);
      expect(updated[0].state).toBe('accepted');

      // Wait for send to complete (using a longer delay to ensure async completion)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should be completed
      updated = queue.getRequestsByFile(mockFile);
      expect(updated[0].state).toBe('completed');
      expect(updated[0].progress).toBe(100);
    }, 10000);

    it('should track request lifecycle from pending to rejected', () => {
      queue.addRequest(mockFile, mockFriend);
      const requests = queue.getRequestsByFile(mockFile);
      const requestId = requests[0].id;

      expect(requests[0].state).toBe('pending');

      queue.handleResponse(requestId, false, 'test-hash');

      const updated = queue.getRequestsByFile(mockFile);
      expect(updated[0].state).toBe('rejected');
    });
  });
});
