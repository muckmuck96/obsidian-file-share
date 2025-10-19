import { Secure } from '../../src/security/Secure';
import { TFile } from 'obsidian';
import * as crypto from 'crypto';

// Mock FileSharePlugin
const createMockPlugin = (privateKey?: string, publicKey?: string) => {
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const mockPrivateKey = privateKey || keyPair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const mockPublicKey = publicKey || Buffer.from(
    keyPair.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString()
  ).toString('base64');

  return {
    settings: {
      privateKey: mockPrivateKey,
      publicKey: mockPublicKey,
      chunkSize: 262144, // 256KB
    },
    app: {
      vault: {
        readBinary: jest.fn().mockResolvedValue(Buffer.from('test file content')),
      },
    },
    secure: null as any,
  };
};

describe('Secure', () => {
  let secure: Secure;
  let mockPlugin: any;
  let mockFile: TFile;
  let mockFriend: any;

  beforeEach(() => {
    mockPlugin = createMockPlugin();
    secure = new Secure(mockPlugin);
    mockPlugin.secure = secure;

    mockFile = new TFile();
    mockFile.path = 'test.md';
    mockFile.name = 'test.md';
    mockFile.extension = 'md';
    mockFriend = {
      username: 'TestFriend',
      publicKey: mockPlugin.settings.publicKey,
    };
  });

  describe('generateKeyPair', () => {
    it('should generate a valid RSA key pair', async () => {
      const keyPair = await secure.generateKeyPair();

      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair.privateKey).toContain('-----BEGIN RSA PRIVATE KEY-----');
      expect(typeof keyPair.publicKey).toBe('string');
    });

    it('should generate different key pairs on multiple calls', async () => {
      const keyPair1 = await secure.generateKeyPair();
      const keyPair2 = await secure.generateKeyPair();

      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    });

    it('should generate 2048-bit RSA keys', async () => {
      const keyPair = await secure.generateKeyPair();
      const publicKeyObj = crypto.createPublicKey(
        Buffer.from(keyPair.publicKey, 'base64').toString()
      );

      // @ts-ignore - accessing asymmetricKeyDetails
      const keySize = publicKeyObj.asymmetricKeyDetails?.modulusLength;
      expect(keySize).toBe(2048);
    });
  });

  describe('serializePublicKey', () => {
    it('should correctly deserialize a base64 encoded public key', () => {
      const originalKey = '-----BEGIN RSA PUBLIC KEY-----\ntest\n-----END RSA PUBLIC KEY-----';
      const base64Key = Buffer.from(originalKey).toString('base64');

      const deserialized = secure.serializePublicKey(base64Key);

      expect(deserialized).toBe(originalKey);
    });

    it('should handle round-trip serialization', async () => {
      const keyPair = await secure.generateKeyPair();
      const deserialized = secure.serializePublicKey(keyPair.publicKey);

      expect(deserialized).toContain('-----BEGIN RSA PUBLIC KEY-----');
    });
  });

  describe('signFile and verifySignature', () => {
    it('should sign a file and verify the signature', async () => {
      const fileContent = Buffer.from('test file content');
      mockPlugin.app.vault.readBinary.mockResolvedValue(fileContent);

      const signature = await secure.signFile(mockFile);
      expect(signature).not.toBeNull();
      expect(typeof signature).toBe('string');

      const publicKey = secure.serializePublicKey(mockPlugin.settings.publicKey);
      const verified = await secure.verifySignature(fileContent, signature!, publicKey);

      expect(verified).toBe(true);
    });

    it('should fail verification with tampered content', async () => {
      const originalContent = Buffer.from('original content');
      mockPlugin.app.vault.readBinary.mockResolvedValue(originalContent);

      const signature = await secure.signFile(mockFile);

      const tamperedContent = Buffer.from('tampered content');
      const publicKey = secure.serializePublicKey(mockPlugin.settings.publicKey);
      const verified = await secure.verifySignature(tamperedContent, signature!, publicKey);

      expect(verified).toBe(false);
    });

    it('should fail verification with wrong public key', async () => {
      const fileContent = Buffer.from('test file content');
      mockPlugin.app.vault.readBinary.mockResolvedValue(fileContent);

      const signature = await secure.signFile(mockFile);

      // Generate a different key pair
      const differentKeyPair = await secure.generateKeyPair();
      const differentPublicKey = secure.serializePublicKey(differentKeyPair.publicKey);

      const verified = await secure.verifySignature(fileContent, signature!, differentPublicKey);

      expect(verified).toBe(false);
    });

    it('should return null when signing null file', async () => {
      const signature = await secure.signFile(null as any);
      expect(signature).toBeNull();
    });
  });

  describe('signData', () => {
    it('should sign data and produce consistent signatures', () => {
      const data = 'test data';

      const signature1 = secure.signData(data);
      const signature2 = secure.signData(data);

      expect(signature1).toBe(signature2);
      expect(typeof signature1).toBe('string');
    });

    it('should produce different signatures for different data', () => {
      const signature1 = secure.signData('data1');
      const signature2 = secure.signData('data2');

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('generateHash', () => {
    it('should generate consistent hash for same data', () => {
      const data = { filename: 'test.md', from: 'user1' };

      const hash1 = secure.generateHash(data);
      const hash2 = secure.generateHash(data);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different data', () => {
      const data1 = { filename: 'test.md', from: 'user1' };
      const data2 = { filename: 'test.md', from: 'user2' };

      const hash1 = secure.generateHash(data1);
      const hash2 = secure.generateHash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('encryptFile and decryptFile', () => {
    it('should encrypt and decrypt a file successfully', async () => {
      const originalContent = Buffer.from('test file content for encryption');
      mockPlugin.app.vault.readBinary.mockResolvedValue(originalContent);

      const encrypted = await secure.encryptFile(mockFile, mockFriend);

      expect(encrypted).not.toBeNull();
      expect(encrypted!.file).toBeTruthy();
      expect(encrypted!.aesKey).toBeTruthy();
      expect(encrypted!.iv).toBeTruthy();
      expect(encrypted!.signature).toBeTruthy();
      expect(encrypted!.filename).toBe('test.md');

      // Decrypt the file
      const decrypted = await secure.decryptFile(
        Buffer.from(encrypted!.aesKey, 'base64'),
        Buffer.from(encrypted!.iv, 'base64'),
        Buffer.from(encrypted!.file, 'base64')
      );

      expect(decrypted.toString()).toBe(originalContent.toString());
    });

    it('should produce different encrypted output for same file on multiple encryptions', async () => {
      const fileContent = Buffer.from('same content');
      mockPlugin.app.vault.readBinary.mockResolvedValue(fileContent);

      const encrypted1 = await secure.encryptFile(mockFile, mockFriend);
      const encrypted2 = await secure.encryptFile(mockFile, mockFriend);

      // Due to random IV and AES key, encrypted files should be different
      expect(encrypted1!.file).not.toBe(encrypted2!.file);
      expect(encrypted1!.iv).not.toBe(encrypted2!.iv);
      expect(encrypted1!.aesKey).not.toBe(encrypted2!.aesKey);
    });

    it('should fail decryption with wrong private key', async () => {
      const originalContent = Buffer.from('secret content');
      mockPlugin.app.vault.readBinary.mockResolvedValue(originalContent);

      const encrypted = await secure.encryptFile(mockFile, mockFriend);

      // Create a different plugin instance with different keys
      const differentPlugin = createMockPlugin();
      const differentSecure = new Secure(differentPlugin as any);
      differentPlugin.secure = differentSecure;

      // Try to decrypt with wrong private key
      await expect(
        differentSecure.decryptFile(
          Buffer.from(encrypted!.aesKey, 'base64'),
          Buffer.from(encrypted!.iv, 'base64'),
          Buffer.from(encrypted!.file, 'base64')
        )
      ).rejects.toThrow();
    });

    it('should return null when encrypting null file', async () => {
      const encrypted = await secure.encryptFile(null as any, mockFriend);
      expect(encrypted).toBeNull();
    });
  });

  describe('encryptFileChunked and decryptChunk', () => {
    it('should encrypt file into chunks and decrypt them', async () => {
      const originalContent = Buffer.from('a'.repeat(300000)); // 300KB file
      mockPlugin.app.vault.readBinary.mockResolvedValue(originalContent);

      const result = await secure.encryptFileChunked(mockFile, mockFriend);

      expect(result).not.toBeNull();
      expect(result!.metadata).toBeTruthy();
      expect(result!.chunks).toBeTruthy();
      expect(result!.chunks.length).toBeGreaterThan(1); // Should be chunked
      expect(result!.metadata.filename).toBe('test.md');
      expect(result!.metadata.totalSize).toBe(300000);

      // Decrypt all chunks
      const decryptedChunks: Buffer[] = [];
      for (const chunk of result!.chunks) {
        const decrypted = await secure.decryptChunk(
          Buffer.from(chunk.aesKey, 'base64'),
          Buffer.from(chunk.iv, 'base64'),
          Buffer.from(chunk.chunkData, 'base64')
        );
        decryptedChunks.push(decrypted);
      }

      const reconstructed = Buffer.concat(decryptedChunks);
      expect(reconstructed.toString()).toBe(originalContent.toString());
    });

    it('should generate unique file ID for each chunked encryption', async () => {
      const fileContent = Buffer.from('a'.repeat(300000));
      mockPlugin.app.vault.readBinary.mockResolvedValue(fileContent);

      const result1 = await secure.encryptFileChunked(mockFile, mockFriend);
      const result2 = await secure.encryptFileChunked(mockFile, mockFriend);

      expect(result1!.metadata.fileId).not.toBe(result2!.metadata.fileId);
    });

    it('should include correct metadata in chunked encryption', async () => {
      const fileContent = Buffer.from('a'.repeat(300000));
      mockPlugin.app.vault.readBinary.mockResolvedValue(fileContent);

      const result = await secure.encryptFileChunked(mockFile, mockFriend);

      expect(result!.metadata.sender).toBe(mockPlugin.settings.publicKey);
      expect(result!.metadata.totalChunks).toBe(result!.chunks.length);

      // All chunks should have the same fileId
      const fileIds = result!.chunks.map(c => c.fileId);
      expect(new Set(fileIds).size).toBe(1);
    });

    it('should handle small files (single chunk)', async () => {
      const smallContent = Buffer.from('small file');
      mockPlugin.app.vault.readBinary.mockResolvedValue(smallContent);

      const result = await secure.encryptFileChunked(mockFile, mockFriend);

      expect(result!.chunks.length).toBe(1);
      expect(result!.metadata.totalChunks).toBe(1);
    });

    it('should return null when encrypting null file', async () => {
      const result = await secure.encryptFileChunked(null as any, mockFriend);
      expect(result).toBeNull();
    });

    it('should return null when file signing fails', async () => {
      // Mock signFile to return null
      jest.spyOn(secure, 'signFile').mockResolvedValue(null);

      const fileContent = Buffer.from('test');
      mockPlugin.app.vault.readBinary.mockResolvedValue(fileContent);

      const result = await secure.encryptFileChunked(mockFile, mockFriend);
      expect(result).toBeNull();
    });
  });

  describe('isSocketURLSecure', () => {
    it('should return true (currently always returns true for testing)', () => {
      const isSecure = secure.isSocketURLSecure();
      expect(isSecure).toBe(true);
    });
  });

  describe('End-to-End encryption workflow', () => {
    it('should complete full encrypt-sign-verify-decrypt workflow', async () => {
      const originalContent = Buffer.from('Complete workflow test content');
      mockPlugin.app.vault.readBinary.mockResolvedValue(originalContent);

      // 1. Encrypt file
      const encrypted = await secure.encryptFile(mockFile, mockFriend);
      expect(encrypted).not.toBeNull();

      // 2. Decrypt file
      const decrypted = await secure.decryptFile(
        Buffer.from(encrypted!.aesKey, 'base64'),
        Buffer.from(encrypted!.iv, 'base64'),
        Buffer.from(encrypted!.file, 'base64')
      );

      // 3. Verify signature
      const publicKey = secure.serializePublicKey(mockPlugin.settings.publicKey);
      const verified = await secure.verifySignature(
        decrypted,
        encrypted!.signature!,
        publicKey
      );

      expect(verified).toBe(true);
      expect(decrypted.toString()).toBe(originalContent.toString());
    });

    it('should detect tampered encrypted data', async () => {
      const originalContent = Buffer.from('Important data');
      mockPlugin.app.vault.readBinary.mockResolvedValue(originalContent);

      const encrypted = await secure.encryptFile(mockFile, mockFriend);

      // Tamper with encrypted data
      const tamperedData = Buffer.from(encrypted!.file, 'base64');
      tamperedData[0] = tamperedData[0] ^ 0xFF; // Flip bits in first byte

      // Decryption should fail or produce garbage
      await expect(
        secure.decryptFile(
          Buffer.from(encrypted!.aesKey, 'base64'),
          Buffer.from(encrypted!.iv, 'base64'),
          tamperedData
        )
      ).rejects.toThrow();
    });
  });
});
