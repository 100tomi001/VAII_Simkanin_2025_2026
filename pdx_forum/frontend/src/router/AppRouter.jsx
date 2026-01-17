import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "../layout/Layout";
import Home from "../pages/Home";
import Forum from "../pages/Forum";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Wiki from "../pages/Wiki";
import WikiArticle from "../pages/WikiArticle";
import WikiEditor from "../pages/WikiEditor";
import NewTopic from "../pages/NewTopic";
import TopicDetail from "../pages/TopicDetails";
import Admin from "../pages/Admin";
import ProfileView from "../pages/ProfileView";
import ProfileEdit from "../pages/ProfileEdit";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/forum" element={<Forum />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/topic/new" element={<NewTopic />} />
          <Route path="/topic/:id" element={<TopicDetail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<ProfileView />} />
          <Route path="/profile/:id" element={<ProfileView />} />
          <Route path="/settings/profile" element={<ProfileEdit />} />
          <Route path="/wiki" element={<Wiki />} />
          <Route path="/wiki/:slug" element={<WikiArticle />} />
          <Route path="/wiki/edit/:id" element={<WikiEditor />} />
          <Route path="/wiki/new" element={<WikiEditor />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
