import React from "react";
import ReactDOM from "react-dom/client";
import "antd/dist/antd.css";
import UploadMain from "./uploadOrDownload";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <UploadMain />
  </React.StrictMode>
);
