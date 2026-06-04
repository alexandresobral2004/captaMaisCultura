import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Settings as SettingsIcon } from "lucide-react"

export default function ConfiguracoesPage() {
  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h2 className="dashboard-title">Configurações</h2>
          <p className="dashboard-subtitle">
            Gerencie as configurações da sua conta e instituição
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-sm">
              <SettingsIcon style={{ width: '1.25rem', height: '1.25rem' }} />
              <CardTitle>Configurações Gerais</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Esta página está em desenvolvimento. Em breve você poderá
              configurar todas as preferências da sua conta aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
