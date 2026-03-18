import { io } from "socket.io-client";
import  { Socket_Url } from "./constants";
export const socket = io(Socket_Url, {
  withCredentials: true,
  autoConnect: false,
  transports: ["websocket"]
});
