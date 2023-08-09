import { setAttrsToElement } from "../common/utils";
import { effect } from "./sandbox";


export default class SandBox {
  active = false; // 沙箱是否在运行
  microWindow = {}; // // 代理的对象
  shadow = null;
  constructor(app) {
    this.shadow = app.shadow;
    this.iframe = this.iframeGenerator(this, window.location.host);
  }
  // 启动
  async start() {
    if (!this.active) {
      this.active = true;
    }

    await this.iframeReady;
    console.log(this.iframe)
    this.releaseEffect = effect(this.iframe.contentWindow)

  }

  // 停止
  stop() {
    if (this.active) {
      this.active = false;
      this.releaseEffect();
    }
  }
  execScript(scripts) {
    const iframeWindow = this.iframe.contentWindow;
    const rawDocumentQuerySelector =
      iframeWindow.Document.prototype.querySelector;
    const rawDocumentCreateElement =
      iframeWindow.Document.prototype.createElement;
    const container = rawDocumentQuerySelector.call(
      iframeWindow.document,
      "head"
    );

    const {
      modifyProperties,
      shadowProperties,
      shadowMethods,
      documentProperties,
      documentMethods,
    } = documentProxyProperties;
    modifyProperties
      .concat(
        shadowProperties,
        shadowMethods,
        documentProperties,
        documentMethods
      )
      .forEach((propKey) => {
        const descriptor = Object.getOwnPropertyDescriptor(
          iframeWindow.Document.prototype,
          propKey
        ) || {
          enumerable: true,
          writable: true,
        };
        try {
          Object.defineProperty(iframeWindow.Document.prototype, propKey, {
            enumerable: descriptor.enumerable,
            configurable: true,
            get: () => {
              return this.shadow[propKey]
                ? this.shadow[propKey].bind(this.shadow)
                : window.document[propKey].bind(window.document);
            },
          });
        } catch (e) {
          warn(e.message);
        }
      });

    scripts.forEach((script) => {
      const scriptElement = rawDocumentCreateElement.call(
        iframeWindow.document,
        "script"
      );
      scriptElement.textContent = script;
      container.appendChild(scriptElement);
    });
  }
  stopIframeLoading(iframeWindow) {
    const oldDoc = iframeWindow.document;
    return new Promise((resolve) => {
      function loop() {
        setTimeout(() => {
          let newDoc = null;
          try {
            newDoc = iframeWindow.document;
          } catch (err) {
            newDoc = null;
          }
          // wait for document ready
          if (!newDoc || newDoc == oldDoc) {
            loop();
          } else {
            iframeWindow.stop
              ? iframeWindow.stop()
              : iframeWindow.document.execCommand("Stop");
            resolve();
          }
        }, 1);
      }
      loop();
    });
  }

  iframeGenerator(sandbox, mainHostPath) {
    const iframe = window.document.createElement("iframe");
    const attrsMerge = {
      src: mainHostPath,
      style: "display: none",
    };
    setAttrsToElement(iframe, attrsMerge);
    window.document.body.appendChild(iframe);
    const iframeWindow = iframe.contentWindow;
    // 变量需要提前注入，在入口函数通过变量防止死循环
    iframeWindow.__MICRO_DEMO_FLAG = "micro-demo";
    sandbox.iframeReady = this.stopIframeLoading(iframeWindow).then(() => {
      console.log(223);
      if (!iframeWindow.__MICRO_DEMO_FLAG) {
        iframeWindow.__MICRO_DEMO_FLAG = "micro-demo";
      }
    });
    return iframe;
  }
}

// 分类document上需要处理的属性，不同类型会进入不同的处理逻辑
const documentProxyProperties = {
  // 降级场景下需要本地特殊处理的属性
  modifyLocalProperties: [
    "createElement",
    "createTextNode",
    "documentURI",
    "URL",
    "getElementsByTagName",
  ],

  // 子应用需要手动修正的属性方法
  modifyProperties: [
    "createElement",
    "createTextNode",
    "documentURI",
    "URL",
    "getElementsByTagName",
    "getElementsByClassName",
    "getElementsByName",
    "getElementById",
    "querySelector",
    "querySelectorAll",
    "documentElement",
    "scrollingElement",
    "forms",
    "images",
    "links",
  ],

  // 需要从shadowRoot中获取的属性
  shadowProperties: [
    "activeElement",
    "childElementCount",
    "children",
    "firstElementChild",
    "firstChild",
    "fullscreenElement",
    "lastElementChild",
    "pictureInPictureElement",
    "pointerLockElement",
    "styleSheets",
  ],

  // 需要从shadowRoot中获取的方法
  shadowMethods: [
    "append",
    "contains",
    "getSelection",
    "elementFromPoint",
    "elementsFromPoint",
    "getAnimations",
    "replaceChildren",
  ],

  // 需要从主应用document中获取的属性
  documentProperties: [
    "characterSet",
    "compatMode",
    "contentType",
    "designMode",
    "dir",
    "doctype",
    "embeds",
    "fullscreenEnabled",
    "hidden",
    "implementation",
    "lastModified",
    "pictureInPictureEnabled",
    "plugins",
    "readyState",
    "referrer",
    "visibilityState",
    "fonts",
  ],

  // 需要从主应用document中获取的方法
  documentMethods: [
    "execCommand",
    "createRange",
    "exitFullscreen",
    "exitPictureInPicture",
    "getElementsByTagNameNS",
    "hasFocus",
    "prepend",
  ],

  // 需要从主应用document中获取的事件
  documentEvents: [
    "onpointerlockchange",
    "onpointerlockerror",
    "onbeforecopy",
    "onbeforecut",
    "onbeforepaste",
    "onfreeze",
    "onresume",
    "onsearch",
    "onfullscreenchange",
    "onfullscreenerror",
    "onsecuritypolicyviolation",
    "onvisibilitychange",
  ],

  // 无需修改原型的属性
  ownerProperties: ["head", "body"],
}; // 处理属性get
