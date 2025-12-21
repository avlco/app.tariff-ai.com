import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import NewShipment from './pages/NewShipment';
import Profile from './pages/Profile';
import ReportView from './pages/ReportView';
import Reports from './pages/Reports';
import Shipments from './pages/Shipments';
import Support from './pages/Support';
import ShipmentView from './pages/ShipmentView';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Customers": Customers,
    "Dashboard": Dashboard,
    "NewShipment": NewShipment,
    "Profile": Profile,
    "ReportView": ReportView,
    "Reports": Reports,
    "Shipments": Shipments,
    "Support": Support,
    "ShipmentView": ShipmentView,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};