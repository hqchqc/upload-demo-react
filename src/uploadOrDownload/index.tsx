import { Tabs } from "antd";
import Uploads from "./upload/Uploads";
import "./index.css";
import Download from "./download/download";

interface uploadMainProps {}

const UploadMain: React.FC<uploadMainProps> = () => (
  <Tabs
    defaultActiveKey="1"
    type="card"
    className="container"
    destroyInactiveTabPane
  >
    <Tabs.TabPane tab="上传" key="1">
      <Uploads />
    </Tabs.TabPane>
    <Tabs.TabPane tab="下载" key="2">
      <Download />
    </Tabs.TabPane>
  </Tabs>
);

export default UploadMain;
