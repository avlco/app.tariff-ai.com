import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import ReportView from './pages/ReportView';
import Reports from './pages/Reports';
import Support from './pages/Support';
import Profile from './pages/Profile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "NewReport": NewReport,
    "ReportView": ReportView,
    "Reports": Reports,
    "Support": Support,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};