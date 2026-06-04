"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Users, Building2, MoreVertical, X, Save } from "lucide-react";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: string;
  status: string;
  criadoEm: string | null;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    password: "",
    confirmarPassword: "",
  });
  const [salvando, setSalvando] = useState(false);

  const carregarUsuarios = async () => {
    try {
      setCarregando(true);
      const response = await fetch("/api/v1/usuarios");
      if (!response.ok) throw new Error("Erro ao carregar usuarios");
      const data = await response.json();
      setUsuarios(data);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const handleCadastrar = async () => {
    if (!formData.nome || !formData.email || !formData.password) {
      setErro("Preencha todos os campos");
      return;
    }

    if (formData.password !== formData.confirmarPassword) {
      setErro("Senhas nao coincidem");
      return;
    }

    if (formData.password.length < 6) {
      setErro("Senha deve ter no minimo 6 caracteres");
      return;
    }

    try {
      setSalvando(true);
      setErro("");
      const response = await fetch("/api/v1/usuarios/cadastrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao cadastrar");
      }

      setMostrarModal(false);
      setFormData({ nome: "", email: "", password: "", confirmarPassword: "" });
      carregarUsuarios();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuario?")) return;

    try {
      const response = await fetch(`/api/v1/usuarios/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao excluir");
      carregarUsuarios();
    } catch (err: any) {
      setErro(err.message);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin": return <Badge variant="default">Admin</Badge>;
      case "editor": return <Badge variant="warning">Editor</Badge>;
      default: return <Badge variant="default">Leitor</Badge>;
    }
  };

  return (
    <MainLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="dashboard-title">Gestao da Instituicao</h2>
            <p className="dashboard-subtitle">
              Gerencie sua equipe e mantenha os dados da organizacao atualizados
            </p>
          </div>
          <Button onClick={() => setMostrarModal(true)}>
            <UserPlus style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }} />
            Convidar Novo Usuario
          </Button>
        </div>

        {erro && (
          <div style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--radius-md)",
            color: "#dc2626",
            fontSize: "var(--font-size-sm)"
          }}>
            {erro}
          </div>
        )}

        <div className="dashboard-section">
          <div className="flex items-center gap-sm" style={{ marginBottom: "1rem" }}>
            <Users style={{ width: "1.25rem", height: "1.25rem", color: "var(--color-gray-600)" }} />
            <h3 className="dashboard-section-title">Membros da Equipe</h3>
          </div>

          <Card>
            <div className="overflow-x-auto">
              {carregando ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-gray-500)" }}>
                  Carregando usuarios...
                </div>
              ) : usuarios.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-gray-500)" }}>
                  Nenhum usuario encontrado
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Cargo</th>
                      <th>Nivel de Acesso</th>
                      <th>Status</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id}>
                        <td>
                          <div className="flex items-center gap-md">
                            <div style={{
                              width: "2.25rem",
                              height: "2.25rem",
                              borderRadius: "var(--radius-full)",
                              backgroundColor: "var(--color-gray-200)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "var(--font-size-sm)",
                              fontWeight: 500,
                              color: "var(--color-gray-600)"
                            }}>
                              {usuario.nome.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{usuario.nome}</p>
                              <p className="text-xs text-gray-600">{usuario.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm text-gray-900">{usuario.role}</td>
                        <td>{getRoleBadge(usuario.role)}</td>
                        <td>
                          <Badge variant={usuario.status === "ativo" ? "success" : "danger"}>
                            {usuario.status === "ativo" ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td>
                          <Button variant="ghost" size="sm" onClick={() => handleExcluir(usuario.id)}>
                            Excluir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        <div className="dashboard-section">
          <div className="flex items-center gap-sm" style={{ marginBottom: "1rem" }}>
            <Building2 style={{ width: "1.25rem", height: "1.25rem", color: "var(--color-gray-600)" }} />
            <h3 className="dashboard-section-title">Dados da Instituicao</h3>
          </div>

          <Card>
            <div style={{ padding: "1.5rem" }}>
              <div className="flex gap-lg">
                <div style={{
                  width: "8rem",
                  height: "8rem",
                  backgroundColor: "var(--color-gray-100)",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <Building2 style={{ width: "3rem", height: "3rem", color: "var(--color-gray-400)" }} />
                </div>
                <div style={{
                  flex: 1,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "1rem"
                }}>
                  <div>
                    <label style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 500,
                      color: "var(--color-gray-700)",
                      marginBottom: "0.25rem",
                      display: "block"
                    }}>
                      Nome da Instituicao
                    </label>
                    <Input defaultValue="Prefeitura Municipal de Exemplo" style={{ height: "2.25rem" }} />
                  </div>
                  <div>
                    <label style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 500,
                      color: "var(--color-gray-700)",
                      marginBottom: "0.25rem",
                      display: "block"
                    }}>
                      CNPJ
                    </label>
                    <Input defaultValue="12.345.678/0001-90" style={{ height: "2.25rem" }} />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 500,
                      color: "var(--color-gray-700)",
                      marginBottom: "0.25rem",
                      display: "block"
                    }}>
                      Endereco Completo
                    </label>
                    <Input defaultValue="Praca dos Tres Poderes, 100 - Centro, Exemplo - SP" style={{ height: "2.25rem" }} />
                  </div>
                  <div>
                    <label style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 500,
                      color: "var(--color-gray-700)",
                      marginBottom: "0.25rem",
                      display: "block"
                    }}>
                      Email de Contato Principal
                    </label>
                    <Input defaultValue="contato@exemplo.sp.gov.br" style={{ height: "2.25rem" }} />
                  </div>
                  <div>
                    <label style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 500,
                      color: "var(--color-gray-700)",
                      marginBottom: "0.25rem",
                      display: "block"
                    }}>
                      Telefone
                    </label>
                    <Input defaultValue="(11) 3000-0000" style={{ height: "2.25rem" }} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-md" style={{ marginTop: "1.5rem" }}>
                <Button variant="outline">Cancelar</Button>
                <Button>Salvar Alteracoes</Button>
              </div>
            </div>
          </Card>
        </div>

        {mostrarModal && (
          <div style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50
          }}>
            <div style={{
              backgroundColor: "white",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "28rem"
            }}>
              <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600 }}>
                  Convidar Novo Usuario
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setMostrarModal(false)}>
                  <X style={{ width: "1rem", height: "1rem" }} />
                </Button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 500,
                    display: "block",
                    marginBottom: "0.25rem"
                  }}>
                    Nome completo
                  </label>
                  <Input
                    placeholder="Nome do usuario"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 500,
                    display: "block",
                    marginBottom: "0.25rem"
                  }}>
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 500,
                    display: "block",
                    marginBottom: "0.25rem"
                  }}>
                    Senha
                  </label>
                  <Input
                    type="password"
                    placeholder="Minimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 500,
                    display: "block",
                    marginBottom: "0.25rem"
                  }}>
                    Confirmar senha
                  </label>
                  <Input
                    type="password"
                    placeholder="Repita a senha"
                    value={formData.confirmarPassword}
                    onChange={(e) => setFormData({ ...formData, confirmarPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-md" style={{ marginTop: "1.5rem" }}>
                <Button variant="outline" onClick={() => setMostrarModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCadastrar} disabled={salvando}>
                  <Save style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }} />
                  {salvando ? "Salvando..." : "Cadastrar"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
