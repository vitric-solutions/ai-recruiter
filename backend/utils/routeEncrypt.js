// utils/routeEncrypt.js

export const encryptRoute = (path) => {
  return Buffer.from(path).toString("base64").replace(/=/g, "");
};

export const encryptPath = (path) => {
  return path
    .split("/")
    .map((segment) => {
      if (!segment || segment.startsWith(":")) return segment;
      return encryptRoute(segment);
    })
    .join("/");
};

