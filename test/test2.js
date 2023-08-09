
var documentProxyProperties = {
  // 降级场景下需要本地特殊处理的属性
  modifyLocalProperties: ["createElement", "createTextNode", "documentURI", "URL", "getElementsByTagName"],

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
};






// class SandboxWindow {
//   constructor(context, frameWindow) {
//     return new Proxy(frameWindow, {
//       set(target, name, value) {
//         if (Object.keys(context).includes(name)) {
//           context[name] = value;
//         }
//         target[name] = value;
//       },
//       get(target, name) {
//         // 优先使用共享对象
//         console.log('123')
//         if (Object.keys(context).includes(name)) {
//           return context[name];
//         }
//         if (typeof target[name] === "function" && /[1]/.test(name)) {
//           return target[name].bind && target[name].bind(target);
//         } else {
//           return target[name];
//         }
//       },
//     });
//   }
//   //  ...
// }

let dom =document.querySelector('.shadow');
let shadow = dom.attachShadow({mode:'open'});

console.log(shadow,shadow.getElementById,shadow.getElementsByClassName,shadow.querySelector)

const iframe = document.createElement("iframe", { url: "about:blank" });
document.body.appendChild(iframe);

const iframeWindow = iframe.contentWindow;

const rawDocumentQuerySelector = iframeWindow.Document.prototype.querySelector;
const rawDocumentCreateElement = iframeWindow.Document.prototype.createElement;


const {
  ownerProperties,
  modifyProperties,
  shadowProperties,
  shadowMethods,
  documentProperties,
  documentMethods,
  documentEvents,
} = documentProxyProperties;
modifyProperties.concat(shadowProperties, shadowMethods, documentProperties, documentMethods).forEach((propKey) => {
  const descriptor = Object.getOwnPropertyDescriptor(iframeWindow.Document.prototype, propKey) || {
    enumerable: true,
    writable: true,
  };
  try {
    Object.defineProperty(iframeWindow.Document.prototype, propKey, {
      enumerable: descriptor.enumerable,
      configurable: true,
      get: () => {
        return shadow[propKey]??window.document[propKey]
      }
    });
  } catch (e) {
    warn(e.message);
  }
}); 
const scriptElement = rawDocumentCreateElement.call(iframeWindow.document,"script");
scriptElement.textContent = 'console.log("gg",window.document.getElementById,document.getElementById,document.getElementsByClassName)'

const container = rawDocumentQuerySelector.call(iframeWindow.document, "head");

container.appendChild(scriptElement);

