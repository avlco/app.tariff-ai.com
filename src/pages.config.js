import Customers from './pages/Customers';
import NewShipment from './pages/NewShipment';
import Profile from './pages/Profile';
import ReportView from './pages/ReportView';
import ShipmentView from './pages/ShipmentView';
import Shipments from './pages/Shipments';
import Support from './pages/Support';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Customers": Customers,
    "NewShipment": NewShipment,
    "Profile": Profile,
    "ReportView": ReportView,
    "ShipmentView": ShipmentView,
    "Shipments": Shipments,
    "Support": Support,
    "Dashboard": Dashboard,
    "Reports": Reports,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};