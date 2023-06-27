/**
 * 获取静态资源
 * @param {string} url 静态资源地址
 */
export function fetchSource(url) {
  return fetch(url).then((res) => {
    return res.text();
  });
}

export function runStyleAndScript(styles, scripts, domHeader) {
  for (let styleCode of styles) {
    const link2Style = document.createElement("style");
    link2Style.textContent = styleCode;
    domHeader.appendChild(link2Style);
  }
  for (let code of scripts) {
    (0, eval)(code);
  }
}
