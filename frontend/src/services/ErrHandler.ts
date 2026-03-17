import type { AxiosError } from "axios";
import { adminPath } from "../routes/EncryptRoute";

export const handleErrResult = (err: AxiosError) => {
  const status = err.response?.status;

  if (status === 401 || status === 403) {
    const userData = localStorage.getItem("user");

    let role = "";

    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        role = parsedUser.role;
      } catch (error) {
        console.error("Invalid user data in localStorage");
      }
    }

    if (role === "admin") {
      window.location.replace(`/admin${adminPath("login")}`);
    } else {
      window.location.replace(`/user${adminPath("login")}`); // user login route
    }
  }
};