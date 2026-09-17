import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './pages/Layout'
import Login from './pages/Login'
import MapView from './pages/MapView'
import Farms from './pages/Farms'
import Devices from './pages/Devices'
import DeviceDetail from './pages/DeviceDetail'
import Geofences from './pages/Geofences'
import OperatorLayout from './pages/operador/OperatorLayout'
import OperatorHome from './pages/operador/OperatorHome'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Link de convite do gestor: mesma tela de login/cadastro, mas
              com o código de convite disponível via useParams. */}
          <Route path="/convite/:code" element={<Login />} />

          <Route element={<Layout />}>
            <Route path="/" element={<MapView />} />
            <Route path="/fazendas" element={<Farms />} />
            <Route path="/equipamentos" element={<Devices />} />
            <Route path="/equipamentos/:id" element={<DeviceDetail />} />
            <Route path="/geofences" element={<Geofences />} />
          </Route>

          {/* Área do operador — rotas vazias por enquanto, conteúdo vem na
              Etapa 3. OperatorLayout já garante que só role='operador'
              acessa (gestor é redirecionado pra "/"). */}
          <Route path="/operador" element={<OperatorLayout />}>
            <Route index element={<OperatorHome />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
