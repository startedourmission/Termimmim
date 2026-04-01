class FileSystem {
  constructor() {
    this.root = {
      type: 'dir',
      children: {
        home: {
          type: 'dir',
          children: {
            user: {
              type: 'dir',
              children: {
                'welcome.txt': {
                  type: 'file',
                  content: 'Welcome to Termimmim!\nType "help" to see available commands.\nType "git help" to see git commands.\n'
                },
                projects: { type: 'dir', children: {} },
                documents: { type: 'dir', children: {} },
              }
            }
          }
        },
        tmp: { type: 'dir', children: {} },
        etc: { type: 'dir', children: {} },
      }
    };
    this.currentPath = '/home/user';
  }

  resolvePath(path) {
    if (!path) return this.currentPath;
    if (path === '~') return '/home/user';
    if (path.startsWith('~/')) path = '/home/user' + path.slice(1);
    if (!path.startsWith('/')) {
      path = this.currentPath === '/' ? '/' + path : this.currentPath + '/' + path;
    }
    // normalize . and ..
    const parts = path.split('/').filter(Boolean);
    const resolved = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { resolved.pop(); continue; }
      resolved.push(part);
    }
    return '/' + resolved.join('/');
  }

  getNode(path) {
    const resolved = this.resolvePath(path);
    if (resolved === '/') return this.root;
    const parts = resolved.split('/').filter(Boolean);
    let node = this.root;
    for (const part of parts) {
      if (!node || node.type !== 'dir' || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  getParentAndName(path) {
    const resolved = this.resolvePath(path);
    const parts = resolved.split('/').filter(Boolean);
    const name = parts.pop();
    const parentPath = '/' + parts.join('/');
    const parent = this.getNode(parentPath);
    return { parent, name, parentPath };
  }

  listDir(path) {
    const node = this.getNode(path || '.');
    if (!node) return { error: `ls: cannot access '${path}': No such file or directory` };
    if (node.type !== 'dir') return { entries: [{ name: path.split('/').pop(), type: 'file' }] };
    const entries = Object.keys(node.children).sort().map(name => ({
      name,
      type: node.children[name].type
    }));
    return { entries };
  }

  changeDir(path) {
    if (!path || path === '~') { this.currentPath = '/home/user'; return {}; }
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (!node) return { error: `cd: no such file or directory: ${path}` };
    if (node.type !== 'dir') return { error: `cd: not a directory: ${path}` };
    this.currentPath = resolved;
    return {};
  }

  readFile(path) {
    const node = this.getNode(path);
    if (!node) return { error: `cat: ${path}: No such file or directory` };
    if (node.type === 'dir') return { error: `cat: ${path}: Is a directory` };
    return { content: node.content };
  }

  writeFile(path, content, append) {
    const { parent, name } = this.getParentAndName(path);
    if (!parent) return { error: `No such file or directory` };
    if (parent.type !== 'dir') return { error: `Not a directory` };
    if (parent.children[name] && parent.children[name].type === 'dir') {
      return { error: `Is a directory` };
    }
    if (append && parent.children[name]) {
      parent.children[name].content += content;
    } else {
      parent.children[name] = { type: 'file', content: content };
    }
    return {};
  }

  createDir(path) {
    const { parent, name } = this.getParentAndName(path);
    if (!parent) return { error: `mkdir: cannot create directory '${path}': No such file or directory` };
    if (parent.children[name]) return { error: `mkdir: cannot create directory '${path}': File exists` };
    parent.children[name] = { type: 'dir', children: {} };
    return {};
  }

  remove(path, recursive) {
    const { parent, name } = this.getParentAndName(path);
    if (!parent || !parent.children[name]) {
      return { error: `rm: cannot remove '${path}': No such file or directory` };
    }
    const node = parent.children[name];
    if (node.type === 'dir' && !recursive) {
      return { error: `rm: cannot remove '${path}': Is a directory (use rm -r)` };
    }
    delete parent.children[name];
    return {};
  }

  copy(src, dest) {
    const srcNode = this.getNode(src);
    if (!srcNode) return { error: `cp: cannot stat '${src}': No such file or directory` };
    if (srcNode.type === 'dir') return { error: `cp: -r not specified; omitting directory '${src}'` };

    const destNode = this.getNode(dest);
    if (destNode && destNode.type === 'dir') {
      const srcName = src.split('/').filter(Boolean).pop();
      destNode.children[srcName] = { type: 'file', content: srcNode.content };
    } else {
      const { parent, name } = this.getParentAndName(dest);
      if (!parent) return { error: `cp: cannot create '${dest}': No such file or directory` };
      parent.children[name] = { type: 'file', content: srcNode.content };
    }
    return {};
  }

  move(src, dest) {
    const srcResolved = this.resolvePath(src);
    const { parent: srcParent, name: srcName } = this.getParentAndName(srcResolved);
    if (!srcParent || !srcParent.children[srcName]) {
      return { error: `mv: cannot stat '${src}': No such file or directory` };
    }
    const srcNode = srcParent.children[srcName];
    const destNode = this.getNode(dest);
    if (destNode && destNode.type === 'dir') {
      destNode.children[srcName] = srcNode;
    } else {
      const { parent, name } = this.getParentAndName(dest);
      if (!parent) return { error: `mv: cannot move '${src}' to '${dest}': No such file or directory` };
      parent.children[name] = srcNode;
    }
    delete srcParent.children[srcName];
    return {};
  }

  touch(path) {
    const node = this.getNode(path);
    if (node) return {};
    return this.writeFile(path, '');
  }

  exists(path) {
    return this.getNode(path) !== null;
  }

  isDir(path) {
    const node = this.getNode(path);
    return node && node.type === 'dir';
  }

  getShortPath() {
    if (this.currentPath === '/home/user') return '~';
    if (this.currentPath.startsWith('/home/user/')) return '~' + this.currentPath.slice(10);
    return this.currentPath;
  }

  // Get all file paths under a directory (recursive)
  getAllFiles(path, prefix) {
    const node = this.getNode(path || '.');
    if (!node || node.type !== 'dir') return [];
    prefix = prefix || '';
    const files = [];
    for (const [name, child] of Object.entries(node.children)) {
      const fullName = prefix ? prefix + '/' + name : name;
      if (child.type === 'file') {
        files.push(fullName);
      } else {
        files.push(...this.getAllFiles(
          (path || this.currentPath) + '/' + name,
          fullName
        ));
      }
    }
    return files;
  }
}
