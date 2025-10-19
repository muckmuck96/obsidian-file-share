// Mock for Obsidian API
export class Notice {
  constructor(message: string) {
    console.log('Notice:', message);
  }
}

export class Plugin {
  app: any;
  manifest: any;

  constructor() {
    this.app = {};
    this.manifest = {};
  }

  async loadData() {
    return {};
  }

  async saveData(data: any) {
    return;
  }

  addCommand(command: any) {
    return;
  }

  addRibbonIcon(icon: string, title: string, callback: any) {
    return;
  }

  addSettingTab(tab: any) {
    return;
  }

  registerEvent(event: any) {
    return;
  }
}

export class PluginSettingTab {
  app: any;
  plugin: any;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  display() {
    return;
  }
}

export class Modal {
  app: any;

  constructor(app: any) {
    this.app = app;
  }

  open() {
    return;
  }

  close() {
    return;
  }

  onOpen() {
    return;
  }

  onClose() {
    return;
  }
}

export class SuggestModal extends Modal {
  getSuggestions(query: string): any[] {
    return [];
  }

  renderSuggestion(item: any, el: HTMLElement) {
    return;
  }

  onChooseSuggestion(item: any, evt: MouseEvent | KeyboardEvent) {
    return;
  }
}

export class Setting {
  settingEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.settingEl = document.createElement('div');
  }

  setName(name: string) {
    return this;
  }

  setDesc(desc: string) {
    return this;
  }

  addText(cb: (text: any) => any) {
    const textComponent = {
      setValue: (value: string) => textComponent,
      onChange: (callback: (value: string) => any) => textComponent,
      setPlaceholder: (placeholder: string) => textComponent,
    };
    cb(textComponent);
    return this;
  }

  addTextArea(cb: (text: any) => any) {
    const textComponent = {
      setValue: (value: string) => textComponent,
      onChange: (callback: (value: string) => any) => textComponent,
      setPlaceholder: (placeholder: string) => textComponent,
    };
    cb(textComponent);
    return this;
  }

  addToggle(cb: (toggle: any) => any) {
    const toggleComponent = {
      setValue: (value: boolean) => toggleComponent,
      onChange: (callback: (value: boolean) => any) => toggleComponent,
    };
    cb(toggleComponent);
    return this;
  }

  addButton(cb: (button: any) => any) {
    const buttonComponent = {
      setButtonText: (text: string) => buttonComponent,
      setCta: () => buttonComponent,
      onClick: (callback: () => any) => buttonComponent,
    };
    cb(buttonComponent);
    return this;
  }

  addDropdown(cb: (dropdown: any) => any) {
    const dropdownComponent = {
      addOption: (value: string, display: string) => dropdownComponent,
      setValue: (value: string) => dropdownComponent,
      onChange: (callback: (value: string) => any) => dropdownComponent,
    };
    cb(dropdownComponent);
    return this;
  }
}

export class TFile {
  path: string;
  name: string;
  extension: string;
  basename: string;
  stat: { size: number; ctime: number; mtime: number };

  constructor(path?: string) {
    this.path = path || '';
    this.name = path ? (path.split('/').pop() || '') : '';
    this.extension = this.name ? (this.name.split('.').pop() || '') : '';
    this.basename = this.name.replace(`.${this.extension}`, '');
    this.stat = {
      size: 1024,
      ctime: Date.now(),
      mtime: Date.now(),
    };
  }
}

export class TFolder {
  path: string;
  name: string;
  children: any[];

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.children = [];
  }
}

export class Vault {
  async read(file: TFile): Promise<string> {
    return '';
  }

  async readBinary(file: TFile): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async create(path: string, data: string): Promise<TFile> {
    return new TFile(path);
  }

  async createBinary(path: string, data: ArrayBuffer): Promise<TFile> {
    return new TFile(path);
  }

  async modify(file: TFile, data: string): Promise<void> {
    return;
  }

  async modifyBinary(file: TFile, data: ArrayBuffer): Promise<void> {
    return;
  }

  async delete(file: TFile): Promise<void> {
    return;
  }

  getAbstractFileByPath(path: string): TFile | TFolder | null {
    return new TFile(path);
  }

  async createFolder(path: string): Promise<void> {
    return;
  }
}

export const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/');
};
