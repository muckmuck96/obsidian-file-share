import { Secure } from '../../src/security/Secure';
import { FileValidator } from '../../src/utils/FileValidator';
import { FileRequestQueue } from '../../src/core/FileRequestQueue';
import { TFile } from 'obsidian';
import * as crypto from 'crypto';

/**
 * Integration Tests: End-to-End Workflows
 *
 * These tests verify that multiple components work correctly together
 * to complete full file sharing workflows.
 */

// Mock crypto.randomUUID if not available
if (typeof global.crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: jest.fn(() => `mock-uuid-${Math.random()}`),
  };
}

// Helper to create a complete mock plugin with all components
const createIntegratedPlugin = () => {
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const plugin = {
    settings: {
      privateKey: keyPair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
      publicKey: Buffer.from(
        keyPair.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString()
      ).toString('base64'),
      chunkSize: 262144, // 256KB
      maxFileSize: 524288000, // 500MB
    },
    app: {
      vault: {
        readBinary: jest.fn(),
        adapter: {
          stat: jest.fn(),
        },
      },
    },
    socket: {
      send: jest.fn(),
    },
    secure: null as any,
    validator: null as any,
    requestQueue: null as any,
  };

  // Initialize components
  plugin.secure = new Secure(plugin as any);
  plugin.validator = new FileValidator(plugin as any);

  const mockSendFile = jest.fn().mockResolvedValue(undefined);
  plugin.requestQueue = new FileRequestQueue(mockSendFile, plugin as any);

  return { plugin, mockSendFile };
};

const createMockFile = (name: string, path: string, size: number = 1024): TFile => {
  const file = new TFile();
  file.name = name;
  file.path = path;
  file.extension = name.split('.').pop() || '';
  file.stat.size = size;
  return file;
};

const createMockFriend = (username: string, publicKey: string) => {
  return { username, publicKey };
};

describe('Integration Tests: End-to-End Workflows', () => {

  describe('Complete File Sharing Workflow', () => {
    it('should complete full workflow: validate -> encrypt -> request -> accept -> transmit', async () => {
      const { plugin, mockSendFile } = createIntegratedPlugin();

      // Step 1: Create a file
      const file = createMockFile('document.pdf', '/vault/document.pdf', 50000);
      plugin.app.vault.readBinary.mockResolvedValue(Buffer.from('test file content'));
      plugin.app.vault.adapter.stat.mockResolvedValue({ size: 50000 });

      // Step 2: Create a friend (another user with their own keys)
      const friendKeyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const friend = createMockFriend(
        'Alice',
        Buffer.from(
          friendKeyPair.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString()
        ).toString('base64')
      );

      // Step 3: Validate the file
      const validation = await plugin.validator.validateFile(file);
      expect(validation.valid).toBe(true);

      // Step 4: Add request to queue
      plugin.requestQueue.addRequest(file, friend);
      const requests = plugin.requestQueue.getRequestsByFile(file);
      expect(requests.length).toBe(1);
      expect(requests[0].state).toBe('pending');

      // Step 5: Simulate friend accepting the request
      const requestId = requests[0].id;
      const hash = plugin.secure.generateHash({ filename: file.name, from: friend.username });

      plugin.requestQueue.handleResponse(requestId, true, hash);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // Step 6: Verify request was accepted and file send was initiated
      expect(mockSendFile).toHaveBeenCalledWith(file, friend, hash, undefined);

      const updatedRequests = plugin.requestQueue.getRequestsByFile(file);
      expect(updatedRequests[0].state).toBe('completed');
      expect(updatedRequests[0].progress).toBe(100);
    }, 10000);

    it('should handle rejection workflow correctly', async () => {
      const { plugin, mockSendFile } = createIntegratedPlugin();

      const file = createMockFile('test.md', '/vault/test.md');
      plugin.app.vault.adapter.stat.mockResolvedValue({ size: 1024 });

      const friend = createMockFriend('Bob', plugin.settings.publicKey);

      // Add request
      plugin.requestQueue.addRequest(file, friend);
      const requests = plugin.requestQueue.getRequestsByFile(file);
      const requestId = requests[0].id;

      // Simulate friend rejecting the request
      plugin.requestQueue.handleResponse(requestId, false, 'hash');

      // Verify rejection
      const updatedRequests = plugin.requestQueue.getRequestsByFile(file);
      expect(updatedRequests[0].state).toBe('rejected');
      expect(mockSendFile).not.toHaveBeenCalled();
    });
  });

  describe('Encryption and Decryption Workflow', () => {
    it('should encrypt file from sender and decrypt at receiver', async () => {
      // Sender's setup
      const { plugin: sender } = createIntegratedPlugin();
      const senderFile = createMockFile('secret.md', '/vault/secret.md');
      const originalContent = Buffer.from('This is a secret message!');
      sender.app.vault.readBinary.mockResolvedValue(originalContent);

      // Receiver's setup (different keys)
      const { plugin: receiver } = createIntegratedPlugin();
      const receiverFriend = createMockFriend('Receiver', receiver.settings.publicKey);

      // Step 1: Sender encrypts file for receiver
      const encrypted = await sender.secure.encryptFile(senderFile, receiverFriend);

      expect(encrypted).not.toBeNull();
      expect(encrypted!.file).toBeTruthy();
      expect(encrypted!.aesKey).toBeTruthy();
      expect(encrypted!.iv).toBeTruthy();
      expect(encrypted!.signature).toBeTruthy();

      // Step 2: Receiver decrypts the file
      const decrypted = await receiver.secure.decryptFile(
        Buffer.from(encrypted!.aesKey, 'base64'),
        Buffer.from(encrypted!.iv, 'base64'),
        Buffer.from(encrypted!.file, 'base64')
      );

      expect(decrypted.toString()).toBe(originalContent.toString());

      // Step 3: Receiver verifies signature using sender's public key
      const senderPublicKey = sender.secure.serializePublicKey(sender.settings.publicKey);
      const verified = await receiver.secure.verifySignature(
        decrypted,
        encrypted!.signature!,
        senderPublicKey
      );

      expect(verified).toBe(true);
    });

    it('should handle large file with chunked encryption and decryption', async () => {
      const { plugin: sender } = createIntegratedPlugin();
      const { plugin: receiver } = createIntegratedPlugin();

      const largeFile = createMockFile('large.pdf', '/vault/large.pdf', 300000);
      const originalContent = Buffer.from('x'.repeat(300000)); // 300KB file
      sender.app.vault.readBinary.mockResolvedValue(originalContent);

      const receiverFriend = createMockFriend('Receiver', receiver.settings.publicKey);

      // Encrypt file in chunks
      const result = await sender.secure.encryptFileChunked(largeFile, receiverFriend);

      expect(result).not.toBeNull();
      expect(result!.chunks.length).toBeGreaterThan(1);
      expect(result!.metadata.totalSize).toBe(300000);

      // Decrypt all chunks
      const decryptedChunks: Buffer[] = [];
      for (const chunk of result!.chunks) {
        const decrypted = await receiver.secure.decryptChunk(
          Buffer.from(chunk.aesKey, 'base64'),
          Buffer.from(chunk.iv, 'base64'),
          Buffer.from(chunk.chunkData, 'base64')
        );
        decryptedChunks.push(decrypted);
      }

      const reconstructed = Buffer.concat(decryptedChunks);
      expect(reconstructed.toString()).toBe(originalContent.toString());

      // Verify signature
      const senderPublicKey = sender.secure.serializePublicKey(sender.settings.publicKey);
      const verified = await receiver.secure.verifySignature(
        reconstructed,
        result!.chunks[0].signature,
        senderPublicKey
      );

      expect(verified).toBe(true);
    });
  });

  describe('Validation and Security Integration', () => {
    it('should reject invalid file types before encryption', async () => {
      const { plugin } = createIntegratedPlugin();

      const maliciousFile = createMockFile('virus.exe', '/vault/virus.exe');
      plugin.app.vault.adapter.stat.mockResolvedValue({ size: 1024 });

      const validation = await plugin.validator.validateFile(maliciousFile);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('not allowed');

      // Should not proceed to encryption
      const friend = createMockFriend('Alice', plugin.settings.publicKey);
      if (validation.valid) {
        // This should not execute
        await plugin.secure.encryptFile(maliciousFile, friend);
        fail('Should not encrypt invalid file type');
      }
    });

    it('should reject oversized files before encryption', async () => {
      const { plugin } = createIntegratedPlugin();

      const hugeFile = createMockFile('huge.mp4', '/vault/huge.mp4', 600000000); // 600MB
      plugin.app.vault.adapter.stat.mockResolvedValue({ size: 600000000 });

      const validation = await plugin.validator.validateFile(hugeFile);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('exceeds maximum allowed size');
    });

    it('should detect tampered encrypted data', async () => {
      const { plugin: sender } = createIntegratedPlugin();
      const { plugin: receiver } = createIntegratedPlugin();

      const file = createMockFile('important.txt', '/vault/important.txt');
      const originalContent = Buffer.from('Important data');
      sender.app.vault.readBinary.mockResolvedValue(originalContent);

      const receiverFriend = createMockFriend('Receiver', receiver.settings.publicKey);

      // Encrypt
      const encrypted = await sender.secure.encryptFile(file, receiverFriend);

      // Tamper with encrypted data
      const tamperedData = Buffer.from(encrypted!.file, 'base64');
      tamperedData[0] = tamperedData[0] ^ 0xFF; // Flip bits

      // Try to decrypt tampered data
      await expect(
        receiver.secure.decryptFile(
          Buffer.from(encrypted!.aesKey, 'base64'),
          Buffer.from(encrypted!.iv, 'base64'),
          tamperedData
        )
      ).rejects.toThrow();
    });
  });

  describe('Multi-Component Error Handling', () => {
    it('should handle validation failure gracefully in workflow', async () => {
      const { plugin } = createIntegratedPlugin();

      const invalidFile = createMockFile('malware.bat', '/vault/malware.bat');
      plugin.app.vault.adapter.stat.mockResolvedValue({ size: 1024 });

      const friend = createMockFriend('Alice', plugin.settings.publicKey);

      // Validate first
      const validation = await plugin.validator.validateFile(invalidFile);
      expect(validation.valid).toBe(false);

      // Don't add to queue if validation fails
      if (!validation.valid) {
        // Validation failed, don't proceed
        expect(true).toBe(true);
      } else {
        plugin.requestQueue.addRequest(invalidFile, friend);
        fail('Should not add invalid file to queue');
      }
    });

    it('should handle encryption failure in request queue', async () => {
      const { plugin, mockSendFile } = createIntegratedPlugin();

      mockSendFile.mockRejectedValue(new Error('Encryption failed'));

      const file = createMockFile('test.md', '/vault/test.md');
      plugin.app.vault.adapter.stat.mockResolvedValue({ size: 1024 });
      const friend = createMockFriend('Alice', plugin.settings.publicKey);

      plugin.requestQueue.addRequest(file, friend);
      const requests = plugin.requestQueue.getRequestsByFile(file);
      const requestId = requests[0].id;

      plugin.requestQueue.handleResponse(requestId, true, 'hash');

      await new Promise(resolve => setTimeout(resolve, 50));

      const updatedRequests = plugin.requestQueue.getRequestsByFile(file);
      expect(updatedRequests[0].state).toBe('failed');
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should handle file sharing between multiple users', async () => {
      // Create three users
      const { plugin: alice } = createIntegratedPlugin();
      const { plugin: bob } = createIntegratedPlugin();
      const { plugin: charlie } = createIntegratedPlugin();

      const file = createMockFile('shared.md', '/vault/shared.md');
      const content = Buffer.from('Shared content');
      alice.app.vault.readBinary.mockResolvedValue(content);

      // Alice shares with Bob
      const bobFriend = createMockFriend('Bob', bob.settings.publicKey);
      const encryptedForBob = await alice.secure.encryptFile(file, bobFriend);
      expect(encryptedForBob).not.toBeNull();

      // Alice shares with Charlie
      const charlieFriend = createMockFriend('Charlie', charlie.settings.publicKey);
      const encryptedForCharlie = await alice.secure.encryptFile(file, charlieFriend);
      expect(encryptedForCharlie).not.toBeNull();

      // Files should be encrypted differently for each user
      expect(encryptedForBob!.file).not.toBe(encryptedForCharlie!.file);
      expect(encryptedForBob!.aesKey).not.toBe(encryptedForCharlie!.aesKey);

      // Bob decrypts his version
      const bobDecrypted = await bob.secure.decryptFile(
        Buffer.from(encryptedForBob!.aesKey, 'base64'),
        Buffer.from(encryptedForBob!.iv, 'base64'),
        Buffer.from(encryptedForBob!.file, 'base64')
      );

      // Charlie decrypts his version
      const charlieDecrypted = await charlie.secure.decryptFile(
        Buffer.from(encryptedForCharlie!.aesKey, 'base64'),
        Buffer.from(encryptedForCharlie!.iv, 'base64'),
        Buffer.from(encryptedForCharlie!.file, 'base64')
      );

      // Both should have the same content
      expect(bobDecrypted.toString()).toBe(content.toString());
      expect(charlieDecrypted.toString()).toBe(content.toString());
    });

    it('should prevent unauthorized decryption', async () => {
      const { plugin: alice } = createIntegratedPlugin();
      const { plugin: bob } = createIntegratedPlugin();
      const { plugin: eve } = createIntegratedPlugin(); // Unauthorized user

      const file = createMockFile('private.md', '/vault/private.md');
      const content = Buffer.from('Private message for Bob');
      alice.app.vault.readBinary.mockResolvedValue(content);

      // Alice encrypts for Bob
      const bobFriend = createMockFriend('Bob', bob.settings.publicKey);
      const encrypted = await alice.secure.encryptFile(file, bobFriend);

      // Bob can decrypt
      const bobDecrypted = await bob.secure.decryptFile(
        Buffer.from(encrypted!.aesKey, 'base64'),
        Buffer.from(encrypted!.iv, 'base64'),
        Buffer.from(encrypted!.file, 'base64')
      );
      expect(bobDecrypted.toString()).toBe(content.toString());

      // Eve cannot decrypt (wrong private key)
      await expect(
        eve.secure.decryptFile(
          Buffer.from(encrypted!.aesKey, 'base64'),
          Buffer.from(encrypted!.iv, 'base64'),
          Buffer.from(encrypted!.file, 'base64')
        )
      ).rejects.toThrow();
    });
  });

  describe('Request Queue Integration', () => {
    it('should manage concurrent requests from multiple recipients', async () => {
      const { plugin } = createIntegratedPlugin();
      plugin.app.vault.adapter.stat.mockResolvedValue({ size: 1024 });

      const file = createMockFile('popular.md', '/vault/popular.md');
      const alice = createMockFriend('Alice', plugin.settings.publicKey);
      const bob = createMockFriend('Bob', plugin.settings.publicKey);
      const charlie = createMockFriend('Charlie', plugin.settings.publicKey);

      // Add multiple requests for same file
      plugin.requestQueue.addRequest(file, alice);
      plugin.requestQueue.addRequest(file, bob);
      plugin.requestQueue.addRequest(file, charlie);

      const requests = plugin.requestQueue.getRequestsByFile(file);
      expect(requests.length).toBe(3);

      // All should be pending initially
      expect(requests.every((r: any) => r.state === 'pending')).toBe(true);

      // Accept all requests
      requests.forEach((request: any) => {
        plugin.requestQueue.handleResponse(request.id, true, 'hash');
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // All should be completed
      const updatedRequests = plugin.requestQueue.getRequestsByFile(file);
      expect(updatedRequests.every((r: any) => r.state === 'completed')).toBe(true);
    });
  });

  describe('Data Integrity Verification', () => {
    it('should maintain data integrity through full workflow', async () => {
      const { plugin: sender } = createIntegratedPlugin();
      const { plugin: receiver } = createIntegratedPlugin();

      // Create test data with various characters
      const testData = 'Hello World! 你好世界 🎉 Special chars: @#$%^&*()';
      const file = createMockFile('test.txt', '/vault/test.txt');
      const originalContent = Buffer.from(testData, 'utf-8');
      sender.app.vault.readBinary.mockResolvedValue(originalContent);

      const receiverFriend = createMockFriend('Receiver', receiver.settings.publicKey);

      // Encrypt
      const encrypted = await sender.secure.encryptFile(file, receiverFriend);

      // Decrypt
      const decrypted = await receiver.secure.decryptFile(
        Buffer.from(encrypted!.aesKey, 'base64'),
        Buffer.from(encrypted!.iv, 'base64'),
        Buffer.from(encrypted!.file, 'base64')
      );

      // Verify exact match
      expect(decrypted.toString('utf-8')).toBe(testData);
      expect(decrypted.length).toBe(originalContent.length);
    });
  });
});
