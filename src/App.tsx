import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ModalProvider } from './contexts/ModalContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { MobileLayout } from './components/MobileLayout';
import { Dashboard } from './pages/Dashboard';
import { Kanban } from './pages/Kanban';
import { Estoque } from './pages/Estoque';
import { Chat } from './pages/Chat';
import { Financeiro } from './pages/Financeiro';
import { OFS } from './pages/OFS';
import { Configuracoes } from './pages/Configuracoes';
import Otimizador from './pages/Otimizador';
import { Skywalker } from './pages/Skywalker';
import { SkywalkerProvider } from './contexts/SkywalkerContext';
import { NotasFiscais } from './pages/NotasFiscais';
import { GIA } from './pages/GIA';
import { OSPrintView } from './pages/OSPrintView';
import EtiquetaEditor from './pages/EtiquetaEditor';
import { AgendaMobile } from './pages/mobile/AgendaMobile';
import { ExecucaoOS } from './pages/mobile/ExecucaoOS';
import { DesempenhoMobile } from './pages/mobile/DesempenhoMobile';
import { EstoqueTecnicoMobile } from './pages/mobile/EstoqueTecnicoMobile';
import { RegistroVendas } from './pages/RegistroVendas';
import { OrcamentoPublico } from './pages/OrcamentoPublico';
import CustomerIntelligence from './pages/CustomerIntelligence';
import AtomConnect from './pages/AtomConnect';
import { MuralMissoes } from './pages/MuralMissoes';
import { AtomAudit } from './pages/AtomAudit';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, usuario } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0D] flex items-center justify-center">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (usuario?.tipo === 'tecnico_ih' && !window.location.pathname.startsWith('/mobile')) {
    return <Navigate to="/mobile/agenda" replace />;
  }

  return <>{children}</>;
}

function MobileProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, usuario } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (usuario?.tipo !== 'tecnico_ih') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0D] flex items-center justify-center">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

        <Route path="/orcamento/:token" element={<OrcamentoPublico />} />
        <Route path="/etiqueta-editor" element={<EtiquetaEditor />} />

        <Route
          path="/os/print"
          element={
            <ProtectedRoute>
              <OSPrintView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mobile/agenda"
          element={
            <MobileProtectedRoute>
              <MobileLayout>
                <AgendaMobile />
              </MobileLayout>
            </MobileProtectedRoute>
          }
        />

        <Route
          path="/mobile/execucao/:agendamentoId"
          element={
            <MobileProtectedRoute>
              <ExecucaoOS />
            </MobileProtectedRoute>
          }
        />

        <Route
          path="/mobile/estoque"
          element={
            <MobileProtectedRoute>
              <MobileLayout>
                <EstoqueTecnicoMobile />
              </MobileLayout>
            </MobileProtectedRoute>
          }
        />

        <Route
          path="/mobile/desempenho"
          element={
            <MobileProtectedRoute>
              <MobileLayout>
                <DesempenhoMobile />
              </MobileLayout>
            </MobileProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/kanban"
          element={
            <ProtectedRoute>
              <Layout>
                <Kanban />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/estoque"
          element={
            <ProtectedRoute>
              <Layout>
                <Estoque />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/gia"
          element={
            <ProtectedRoute>
              <Layout>
                <GIA />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/otimizador"
          element={
            <ProtectedRoute>
              <Layout>
                <Otimizador />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Layout>
                <Chat />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/financeiro"
          element={
            <ProtectedRoute>
              <Layout>
                <Financeiro />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ofs"
          element={
            <ProtectedRoute>
              <Layout>
                <OFS />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute>
              <Layout>
                <Configuracoes />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/skywalker"
          element={
            <ProtectedRoute>
              <Layout>
                <SkywalkerProvider>
                  <Skywalker />
                </SkywalkerProvider>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/notas-fiscais"
          element={
            <ProtectedRoute>
              <Layout>
                <NotasFiscais />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/registro-vendas"
          element={
            <ProtectedRoute>
              <Layout>
                <RegistroVendas />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customer-intelligence"
          element={
            <ProtectedRoute>
              <Layout>
                <CustomerIntelligence />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/atom-connect"
          element={
            <ProtectedRoute>
              <Layout>
                <AtomConnect />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/mural-missoes"
          element={
            <ProtectedRoute>
              <Layout>
                <MuralMissoes />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <Layout>
                <AtomAudit />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ModalProvider>
          <AppContent />
        </ModalProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
