/**
 * 获取静态资源
 * @param {string} url 静态资源地址
 */
export function fetchSource(url) {
  return fetch(url).then((res) => {
    return res.text();
  });
}

export function runStyleAndScript(styles, scripts, domHeader, app) {
  for (let styleCode of styles) {
    const link2Style = document.createElement("style");
    link2Style.textContent = styleCode;
    domHeader.appendChild(link2Style);
  }
  for (let code of scripts) {
    (0, eval)(app.sandbox.bindScope(code));
    // (0, eval)(code);
  }
}
export function runStyleAndScriptForIframe(styles, scripts, domHeader, app) {
  for (let styleCode of styles) {
    const link2Style = document.createElement("style");
    link2Style.textContent = styleCode;
    domHeader.appendChild(link2Style);
  }
  app.sandbox.execScript(scripts);
}

/**
 * trim start & end
 */
export function trim(str) {
  return str ? str.replace(/^\s+|\s+$/g, "") : "";
}

/**
 * format error log
 * @param msg message
 * @param appName app name, default is null
 */
export function logError(msg, appName, ...rest) {
  const appNameTip = appName && isString(appName) ? ` app ${appName}:` : "";
  if (isString(msg)) {
    console.error(`[micro-demo]${appNameTip} ${msg}`, ...rest);
  } else {
    console.error(`[micro-demo]${appNameTip}`, msg, ...rest);
  }
}

/**
 * Get the folder where the link resource is located,
 * which is used to complete the relative address in the css
 * @param linkPath full link address
 */
export function getLinkFileDir(linkPath) {
  const pathArr = linkPath.split("/");
  pathArr.pop();
  return addProtocol(pathArr.join("/") + "/");
}

/**
 * Add address protocol
 * @param url address
 */
export function addProtocol(url) {
  return url.startsWith("//") ? `${window.location.protocol}${url}` : url;
}

/**
 * Complete address
 * @param path address
 * @param baseURI base url(app.url)
 */
export function CompletionPath(path, baseURI) {
  if (
    !path ||
    /^((((ht|f)tps?)|file):)?\/\//.test(path) ||
    /^(data|blob):/.test(path)
  )
    return path;

  return createURL(path, getEffectivePath(addProtocol(baseURI))).toString();
}

/**
 * create URL
 */
export const createURL = (function () {
  return function (path, base) {
    return base ? new URL(path, base) : new URL(path);
  };
})();
/**
 * Get valid address, such as https://xxx/xx/xx.html to https://xxx/xx/
 * @param url app.url
 */
export function getEffectivePath(url) {
  const { origin, pathname } = createURL(url);
  if (/\.(\w+)$/.test(pathname)) {
    const fullPath = `${origin}${pathname}`;
    const pathArr = fullPath.split("/");
    pathArr.pop();
    return pathArr.join("/") + "/";
  }

  return `${origin}${pathname}/`.replace(/\/\/$/, "/");
}

// is String
export function isString(target) {
  return typeof target === "string";
}

export function setAttrsToElement(element, attrs) {
  Object.keys(attrs).forEach((name) => {
    element.setAttribute(name, attrs[name]);
  });
}
