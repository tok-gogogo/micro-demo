class SnapshotSandBox {
  windowSnapshot = {};
  modifyPropsMap = {};
  active() {
    // 保存window对象上所有属性的状态
    for (const prop in window) {
      this.windowSnapshot[prop] = window[prop];
    }
    // 恢复上一次在运行该微应用的时候所修改过的window上的属性
    Object.keys(this.modifyPropsMap).forEach((prop) => {
      window[prop] = this.modifyPropsMap[prop];
    });
  }
  inactive() {
    for (const prop in window) {
      if (window[prop] !== this.windowSnapshot[prop]) {
        // 记录修改了window上的哪些属性
        this.modifyPropsMap[prop] = window[prop];
        // 将window上的属性状态还原至微应用运行之前的状态
        window[prop] = this.windowSnapshot[prop];
      }
    }
  }
}

window.city = "Beijing";
console.log("激活之前", window.city);
let snapshotSandBox = new SnapshotSandBox();
snapshotSandBox.active();
window.city = "Shanghai";
console.log("激活之后", window.city);
snapshotSandBox.inactive();
console.log("失活之后", window.city);

class LegacySandBox {
  currentUpdatedPropsValueMap = new Map();
  modifiedPropsOriginalValueMapInSandbox = new Map();
  addedPropsMapInSandbox = new Map();
  proxyWindow = {};
  constructor() {
    const fakeWindow = Object.create(null);
    this.proxyWindow = new Proxy(fakeWindow, {
      set: (target, prop, value, receiver) => {
        const originalVal = window[prop];
        if (!window.hasOwnProperty(prop)) {
          this.addedPropsMapInSandbox.set(prop, value);
        } else if (
          !this.modifiedPropsOriginalValueMapInSandbox.hasOwnProperty(prop)
        ) {
          this.modifiedPropsOriginalValueMapInSandbox.set(prop, originalVal);
        }
        this.currentUpdatedPropsValueMap.set(prop, value);
        window[prop] = value;
      },
      get: (target, prop, receiver) => {
        return window[prop];
      },
    });
  }
  active() {
    // 恢复上一次微应用处于运行状态时，对window上做的所有修改
    this.currentUpdatedPropsValueMap.forEach((value, prop) => {
      this.setWindowProp(prop, value);
    });
  }
  inactive() {
    // 还原window上原有的属性
    this.modifiedPropsOriginalValueMapInSandbox.forEach((value, prop) => {
      this.setWindowProp(prop, value);
    });
    // 删除在微应用运行期间，window上新增的属性
    this.addedPropsMapInSandbox.forEach((_, prop) => {
      this.setWindowProp(prop, undefined, true);
    });
  }
  setWindowProp(prop, value, isToDelete = false) {
    //有可能是新增的属性，后面不需要了
    if (value === undefined && isToDelete) {
      delete window[prop];
    } else {
      window[prop] = value;
    }
  }
}

window.city = "Beijing";
let legacySandBox = new LegacySandBox();
console.log("激活之前", window.city);
legacySandBox.active();
legacySandBox.proxyWindow.city = "Shanghai";
console.log("激活之后", window.city);
legacySandBox.inactive();
console.log("失活之后", window.city);

class ProxySandBox {
  proxyWindow = {};
  isRunning = false;
  active() {
    this.isRunning = true;
  }
  inactive() {
    this.isRunning = false;
  }
  constructor() {
    const fakeWindow = Object.create(null);
    this.proxyWindow = new Proxy(fakeWindow, {
      set: (target, prop, value, receiver) => {
        // 设置时只操作fakeWindow
        if (this.isRunning) {
          target[prop] = value;
        }
      },
      get: (target, prop, receiver) => {
        return prop in target ? target[prop] : window[prop];
      },
    });
  }
}

window.city = "Beijing";
let proxySandBox1 = new ProxySandBox();
let proxySandBox2 = new ProxySandBox();
proxySandBox1.active();
proxySandBox2.active();
proxySandBox1.proxyWindow.city = "Shanghai";
proxySandBox2.proxyWindow.city = "Chengdu";
console.log(
  "active:proxySandBox1:window.city:",
  proxySandBox1.proxyWindow.city
);
console.log(
  "active:proxySandBox2:window.city:",
  proxySandBox2.proxyWindow.city
);
console.log("window:window.city:", window.city);
proxySandBox1.inactive();
proxySandBox2.inactive();
console.log(
  "inactive:proxySandBox1:window.city:",
  proxySandBox1.proxyWindow.city
);
console.log(
  "inactive:proxySandBox2:window.city:",
  proxySandBox2.proxyWindow.city
);
console.log("window:window.city:", window.city);

class SandboxWindow {
  constructor(options, context, frameWindow) {
    return new Proxy(frameWindow, {
      set(target, name, value) {
        if (Object.keys(context).includes(name)) {
          context[name] = value;
        }
        target[name] = value;
      },
      get(target, name) {
        // 优先使用共享对象
        if (Object.keys(context).includes(name)) {
          return context[name];
        }
        if (typeof target[name] === "function" && /[1]/.test(name)) {
          return target[name].bind && target[name].bind(target);
        } else {
          return target[name];
        }
      },
    });
  }
}

const iframe = document.createElement("iframe", { url: "about:blank" });
document.body.appendChild(iframe);
const sandboxGlobal = iframe.contentWindow;
// 需要全局共享的变量
const context = { document: window.document, history: window.histroy };
const newSandBoxWindow = new SandboxWindow({}, context, sandboxGlobal);
// newSandBoxWindow.history 全局对象
// newSandBoxWindow.abc 为 'abc' 沙箱环境全局变量
// window.abc 为 undefined


