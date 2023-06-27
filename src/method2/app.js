import { runStyleAndScript } from "../common/utils";
import { loadHtml } from "./source";

export const Status = {
  NOT_LOADED: "NOT_LOADED",
  LOADING: "LOADING",
  NOT_MOUNTED: "NOT_MOUNTED",
  MOUNTING: "MOUNTING",
  MOUNTED: "MOUNTED",
  UNMOUNTING: "UNMOUNTING",
};

let apps = [];

export function register(appArray) {
  appArray.forEach((app) => (app.status = Status.NOT_LOADED));
  apps = appArray;
  hack();
  reroute();
}

function reroute() {
  const { loads, mounts, unmounts } = getAppChanges();
  perform();
  async function perform() {
    unmounts.map(runUnmount);
    loads.map(async (app) => {
      app = await runLoad(app);
      return runMount(app);
    });

    mounts.map(async (app) => {
      return runMount(app);
    });
  }
}

function getAppChanges() {
  const unmounts = [];
  const loads = [];
  const mounts = [];

  apps.forEach((app) => {
    const isActive =
      typeof app.path === "function"
        ? app.path(window.location)
        : window.location.pathname === app.path;
    switch (app.status) {
      case Status.NOT_LOADED:
      case Status.LOADING:
        isActive && loads.push(app);
        break;
      case Status.NOT_MOUNTED:
        isActive && mounts.push(app);
        break;
      case Status.MOUNTED:
        !isActive && unmounts.push(app);
        break;
    }
  });
  return { unmounts, loads, mounts };
}

async function runLoad(app) {
  if (app.loaded) return app.loaded;
  app.loaded = Promise.resolve().then(async () => {
    app.status = Status.LOADING;
    const { template, styles, scripts } = await loadHtml(app);
    app.host = document.querySelector(app.container);
    app.host.innerHTML = template;
    app.status = Status.NOT_MOUNTED;
    app.mount = () => {
      runStyleAndScript(styles, scripts, app.host);
    };
    app.unmount = () => {
      console.log("unmount");
    };
    delete app.loaded;
    return app;
  });
  return app.loaded;
}

async function runUnmount(app) {
  if (app.status != Status.MOUNTED) {
    return app;
  }
  app.status = Status.UNMOUNTING;
  await app.unmount(app);
  app.status = Status.NOT_MOUNTED;
  return app;
}

async function runMount(app) {
  if (app.status !== Status.NOT_MOUNTED) {
    return app;
  }
  app.status = Status.MOUNTING;
  await app.mount(app);
  app.status = Status.MOUNTED;
  return app;
}

function hack() {
  window.addEventListener = hackEventListener(window.addEventListener);
  window.removeEventListener = hackEventListener(window.removeEventListener);

  window.history.pushState = hackHistory(window.history.pushState);
  window.history.replaceState = hackHistory(window.history.replaceState);

  window.addEventListener("hashchange", reroute);
  window.addEventListener("popstate", reroute);
}

const captured = {
  hashchange: [],
  popstate: [],
};

function hackEventListener(func) {
  return function (name, fn) {
    if (name === "hashchange" || name === "popstate") {
      if (!captured[name].some((l) => l == fn)) {
        captured[name].push(fn);
        return;
      } else {
        captured[name] = captured[name].filter((l) => l !== fn);
        return;
      }
    }
    return func.apply(this, arguments);
  };
}

function hackHistory(fn) {
  return function () {
    const before = window.location.href;
    fn.apply(window.history, arguments);
    const after = window.location.href;
    if (before !== after) {
      new PopStateEvent("popstate");
      reroute();
    }
  };
}
