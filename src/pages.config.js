import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import NewReport from './pages/NewReport';
import ReportView from './pages/ReportView';
import ClarifyReport from './pages/ClarifyReport';
import PublicReportView from './pages/PublicReportView';
import Shipments from './pages/Shipments';
import NewShipment from './pages/NewShipment';
import ShipmentView from './pages/ShipmentView';
import Customers from './pages/Customers';
import Profile from './pages/Profile';
import Support from './pages/Support';
import PdfReport from './pages/PdfReport';

export default {
  Pages: {
    Dashboard,
    Reports,
    NewReport,
    ReportView,
    ClarifyReport,
    PublicReportView,
    Shipments,
    NewShipment,
    ShipmentView,
    Customers,
    Profile,
    Support,
    PdfReport,
  },
  Layout,
  mainPage: 'Dashboard'
};
