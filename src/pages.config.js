import ClarifyReport from './pages/ClarifyReport';
import Cookies from './pages/Cookies';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import NewShipment from './pages/NewShipment';
import Privacy from './pages/Privacy';
import Profile from './pages/Profile';
import PublicReportView from './pages/PublicReportView';
import ReportView from './pages/ReportView';
import Reports from './pages/Reports';
import ShipmentView from './pages/ShipmentView';
import Shipments from './pages/Shipments';
import Support from './pages/Support';
import Terms from './pages/Terms';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ClarifyReport": ClarifyReport,
    "Cookies": Cookies,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "NewReport": NewReport,
    "NewShipment": NewShipment,
    "Privacy": Privacy,
    "Profile": Profile,
    "PublicReportView": PublicReportView,
    "ReportView": ReportView,
    "Reports": Reports,
    "ShipmentView": ShipmentView,
    "Shipments": Shipments,
    "Support": Support,
    "Terms": Terms,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};