import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import Profile from './pages/Profile';
import ReportView from './pages/ReportView';
import Reports from './pages/Reports';
import Support from './pages/Support';
import Customers from './pages/Customers';
import Shipments from './pages/Shipments';
import NewShipment from './pages/NewShipment';
import NewShipmentAI from './pages/NewShipmentAI';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "NewReport": NewReport,
    "Profile": Profile,
    "ReportView": ReportView,
    "Reports": Reports,
    "Support": Support,
    "Customers": Customers,
    "Shipments": Shipments,
    "NewShipment": NewShipment,
    "NewShipmentAI": NewShipmentAI,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};