import ClarifyReport from './pages/ClarifyReport';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import NewReport from './pages/NewReport';
import NewShipment from './pages/NewShipment';
import Profile from './pages/Profile';
import PublicReportView from './pages/PublicReportView';
import ReportView from './pages/ReportView';
import Reports from './pages/Reports';
import ShipmentView from './pages/ShipmentView';
import Shipments from './pages/Shipments';
import Support from './pages/Support';
import PdfReport from './pages/PdfReport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ClarifyReport": ClarifyReport,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "NewReport": NewReport,
    "NewShipment": NewShipment,
    "Profile": Profile,
    "PublicReportView": PublicReportView,
    "ReportView": ReportView,
    "Reports": Reports,
    "ShipmentView": ShipmentView,
    "Shipments": Shipments,
    "Support": Support,
    "PdfReport": PdfReport,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};