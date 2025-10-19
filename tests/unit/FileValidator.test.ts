import { FileValidator } from '../../src/utils/FileValidator';
import { TFile } from 'obsidian';

const createMockPlugin = (maxFileSize = 524288000) => {
  return {
    settings: {
      maxFileSize: maxFileSize,
    },
    app: {
      vault: {
        adapter: {
          stat: jest.fn(),
        },
      },
    },
  };
};

const createMockFile = (name: string, extension: string, size = 1024): TFile => {
  const file = new TFile();
  file.path = `path/to/${name}`;
  file.extension = extension;
  file.name = name;
  file.stat.size = size;
  return file;
};

describe('FileValidator', () => {
  let validator: FileValidator;
  let mockPlugin: any;

  beforeEach(() => {
    mockPlugin = createMockPlugin();
    validator = new FileValidator(mockPlugin);
  });

  describe('validateFileType', () => {
    describe('Markdown files', () => {
      it('should allow .md files', () => {
        const file = createMockFile('test.md', 'md');
        const result = validator.validateFileType(file);
        expect(result.valid).toBe(true);
      });

      it('should allow .markdown files', () => {
        const file = createMockFile('test.markdown', 'markdown');
        const result = validator.validateFileType(file);
        expect(result.valid).toBe(true);
      });
    });

    describe('Image files', () => {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];

      imageExtensions.forEach(ext => {
        it(`should allow .${ext} files`, () => {
          const file = createMockFile(`image.${ext}`, ext);
          const result = validator.validateFileType(file);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Video files', () => {
      const videoExtensions = ['mp4', 'webm', 'ogv', 'mov', 'avi', 'mkv'];

      videoExtensions.forEach(ext => {
        it(`should allow .${ext} files`, () => {
          const file = createMockFile(`video.${ext}`, ext);
          const result = validator.validateFileType(file);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Audio files', () => {
      const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];

      audioExtensions.forEach(ext => {
        it(`should allow .${ext} files`, () => {
          const file = createMockFile(`audio.${ext}`, ext);
          const result = validator.validateFileType(file);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Document files', () => {
      const documentExtensions = ['pdf', 'txt', 'rtf'];

      documentExtensions.forEach(ext => {
        it(`should allow .${ext} files`, () => {
          const file = createMockFile(`document.${ext}`, ext);
          const result = validator.validateFileType(file);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Obsidian files', () => {
      it('should allow .excalidraw files', () => {
        const file = createMockFile('drawing.excalidraw', 'excalidraw');
        const result = validator.validateFileType(file);
        expect(result.valid).toBe(true);
      });

      it('should allow .canvas files', () => {
        const file = createMockFile('canvas.canvas', 'canvas');
        const result = validator.validateFileType(file);
        expect(result.valid).toBe(true);
      });
    });

    describe('Data files', () => {
      const dataExtensions = ['json', 'csv', 'xml', 'yaml', 'yml'];

      dataExtensions.forEach(ext => {
        it(`should allow .${ext} files`, () => {
          const file = createMockFile(`data.${ext}`, ext);
          const result = validator.validateFileType(file);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Disallowed file types', () => {
      const disallowedExtensions = ['exe', 'bat', 'sh', 'dll', 'app', 'dmg', 'pkg', 'deb', 'rpm'];

      disallowedExtensions.forEach(ext => {
        it(`should reject .${ext} files`, () => {
          const file = createMockFile(`malware.${ext}`, ext);
          const result = validator.validateFileType(file);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('not allowed');
          expect(result.error).toContain(`.${ext}`);
        });
      });

      it('should provide helpful error message with supported types', () => {
        const file = createMockFile('test.xyz', 'xyz');
        const result = validator.validateFileType(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Supported types');
      });
    });

    describe('Case insensitivity', () => {
      it('should allow uppercase extensions', () => {
        const file = createMockFile('TEST.MD', 'MD');
        file.extension = 'MD';
        const result = validator.validateFileType(file);
        expect(result.valid).toBe(true);
      });

      it('should allow mixed case extensions', () => {
        const file = createMockFile('image.JpG', 'JpG');
        file.extension = 'JpG';
        const result = validator.validateFileType(file);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('validateFileSize', () => {
    it('should allow files under the size limit', async () => {
      const file = createMockFile('small.md', 'md', 1024);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: 1024 });

      const result = await validator.validateFileSize(file);
      expect(result.valid).toBe(true);
    });

    it('should allow files exactly at the size limit', async () => {
      const maxSize = 524288000; // 500MB
      const file = createMockFile('limit.md', 'md', maxSize);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: maxSize });

      const result = await validator.validateFileSize(file);
      expect(result.valid).toBe(true);
    });

    it('should reject files over the size limit', async () => {
      const maxSize = 524288000; // 500MB
      const fileSize = maxSize + 1;
      const file = createMockFile('large.md', 'md', fileSize);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: fileSize });

      const result = await validator.validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });

    it('should provide file size in MB in error message', async () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const fileSize = 15 * 1024 * 1024; // 15MB
      mockPlugin.settings.maxFileSize = maxSize;
      const file = createMockFile('large.pdf', 'pdf', fileSize);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: fileSize });

      const result = await validator.validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('15.00 MB');
      expect(result.error).toContain('10.00 MB');
    });

    it('should handle when file stats cannot be read', async () => {
      const file = createMockFile('missing.md', 'md');
      mockPlugin.app.vault.adapter.stat.mockResolvedValue(null);

      const result = await validator.validateFileSize(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Could not read file statistics');
    });

    it('should respect custom max file size settings', async () => {
      const customMaxSize = 1024 * 1024; // 1MB
      mockPlugin.settings.maxFileSize = customMaxSize;
      const file = createMockFile('test.md', 'md', customMaxSize + 1);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: customMaxSize + 1 });

      const result = await validator.validateFileSize(file);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFile', () => {
    it('should pass validation for valid file type and size', async () => {
      const file = createMockFile('valid.md', 'md', 1024);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: 1024 });

      const result = await validator.validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for invalid file type', async () => {
      const file = createMockFile('malware.exe', 'exe', 1024);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: 1024 });

      const result = await validator.validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should fail validation for oversized file', async () => {
      const maxSize = 524288000;
      const file = createMockFile('huge.md', 'md', maxSize + 1);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: maxSize + 1 });

      const result = await validator.validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });

    it('should check file type before file size', async () => {
      // Invalid type but would pass size check
      const file = createMockFile('test.exe', 'exe', 100);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: 100 });

      const result = await validator.validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
      // Size check should not have been called if type check failed first
    });
  });

  describe('isVideoFile', () => {
    it('should return true for video files', () => {
      const videoFile = createMockFile('video.mp4', 'mp4');
      expect(validator.isVideoFile(videoFile)).toBe(true);
    });

    it('should return false for non-video files', () => {
      const imageFile = createMockFile('image.jpg', 'jpg');
      expect(validator.isVideoFile(imageFile)).toBe(false);
    });

    it('should be case insensitive', () => {
      const videoFile = createMockFile('video.MP4', 'MP4');
      videoFile.extension = 'MP4';
      expect(validator.isVideoFile(videoFile)).toBe(true);
    });
  });

  describe('isImageFile', () => {
    it('should return true for image files', () => {
      const imageFile = createMockFile('image.png', 'png');
      expect(validator.isImageFile(imageFile)).toBe(true);
    });

    it('should return false for non-image files', () => {
      const textFile = createMockFile('document.txt', 'txt');
      expect(validator.isImageFile(textFile)).toBe(false);
    });

    it('should be case insensitive', () => {
      const imageFile = createMockFile('photo.JPG', 'JPG');
      imageFile.extension = 'JPG';
      expect(validator.isImageFile(imageFile)).toBe(true);
    });
  });

  describe('isMarkdownFile', () => {
    it('should return true for .md files', () => {
      const mdFile = createMockFile('note.md', 'md');
      expect(validator.isMarkdownFile(mdFile)).toBe(true);
    });

    it('should return true for .markdown files', () => {
      const markdownFile = createMockFile('readme.markdown', 'markdown');
      expect(validator.isMarkdownFile(markdownFile)).toBe(true);
    });

    it('should return false for non-markdown files', () => {
      const textFile = createMockFile('file.txt', 'txt');
      expect(validator.isMarkdownFile(textFile)).toBe(false);
    });

    it('should be case insensitive', () => {
      const mdFile = createMockFile('NOTE.MD', 'MD');
      mdFile.extension = 'MD';
      expect(validator.isMarkdownFile(mdFile)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty extension', () => {
      const file = createMockFile('noextension', '');
      const result = validator.validateFileType(file);
      expect(result.valid).toBe(false);
    });

    it('should handle very large file sizes', async () => {
      const veryLargeSize = Number.MAX_SAFE_INTEGER;
      mockPlugin.settings.maxFileSize = 524288000;
      const file = createMockFile('huge.md', 'md', veryLargeSize);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: veryLargeSize });

      const result = await validator.validateFileSize(file);
      expect(result.valid).toBe(false);
    });

    it('should handle zero-byte files', async () => {
      const file = createMockFile('empty.md', 'md', 0);
      mockPlugin.app.vault.adapter.stat.mockResolvedValue({ size: 0 });

      const result = await validator.validateFileSize(file);
      expect(result.valid).toBe(true);
    });
  });
});
