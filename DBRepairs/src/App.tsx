import { useEffect, useState } from "react";
import CustomersPage from "./pages/CustomersPage";
import LanguageDropdown from "./components/LanguageDropdown";
import SettingsPage from "./pages/SettingsPage";
import RepairsPage from "./pages/RepairsPage";
import {
  DashboardRecentRepair,
  DashboardStats,
  getDashboardStats,
  listDashboardRecentRepairs,
} from "./data/dashboard";
import { useI18n } from "./i18n/I18nProvider";
import {
  LayoutDashboard,
  Wrench,
  Users,
  Settings,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

type Page = "dashboard" | "repairs" | "customers" | "settings";

const emptyStats: DashboardStats = {
  openRepairs: 0,
  waitingCustomer: 0,
  ready: 0,
  closedToday: 0,
};

function statusPillClass(code: string) {
  if (["RECEIVED", "DIAGNOSIS", "IN_REPAIR", "REPAIRED"].includes(code)) return "status-pill status-" + code.toLowerCase().replace(/_/g, "-");
  if (["WAITING_CUSTOMER", "WAITING_PARTS"].includes(code)) return "status-pill status-" + code.toLowerCase().replace(/_/g, "-");
  if (code === "READY") return "status-pill status-ready";
  if (["DELIVERED", "CANCELLED"].includes(code)) return "status-pill status-" + code.toLowerCase();
  return "status-pill";
}

export default function App() {
  const { t, locale, setLocale, locales } = useI18n();
  const [page, setPage] = useState<Page>("dashboard");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(emptyStats);
  const [recentRepairs, setRecentRepairs] = useState<DashboardRecentRepair[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(false);

  useEffect(() => {
    if (page !== "dashboard") return;

    let active = true;
    setDashboardLoading(true);
    setDashboardError(false);

    Promise.all([getDashboardStats(), listDashboardRecentRepairs()])
      .then(([stats, repairs]) => {
        if (!active) return;
        setDashboardStats(stats);
        setRecentRepairs(repairs);
      })
      .catch((error) => {
        console.error("Dashboard database error:", error);
        if (active) setDashboardError(true);
      })
      .finally(() => {
        if (active) setDashboardLoading(false);
      });

    return () => { active = false; };
  }, [page]);

  const languageControl = (
    <LanguageDropdown
      locale={locale}
      setLocale={setLocale}
      locales={locales}
      label={t("settings.language")}
      searchLabel={t("settings.searchLanguage")}
    />
  );

  const cards = [
    {
      key: "dashboard.openRepairs",
      value: dashboardStats.openRepairs,
      icon: <ClipboardList size={18} />,
      accent: "#2563eb",
      accentL: "#eff6ff",
    },
    {
      key: "dashboard.waitingCustomer",
      value: dashboardStats.waitingCustomer,
      icon: <Clock size={18} />,
      accent: "#d97706",
      accentL: "#fffbeb",
    },
    {
      key: "dashboard.ready",
      value: dashboardStats.ready,
      icon: <CheckCircle size={18} />,
      accent: "#16a34a",
      accentL: "#f0fdf4",
    },
    {
      key: "dashboard.closedToday",
      value: dashboardStats.closedToday,
      icon: <XCircle size={18} />,
      accent: "#64748b",
      accentL: "#f1f5f9",
    },
  ] as const;

  const deviceLabel = (repair: DashboardRecentRepair) =>
    [repair.device_type, repair.brand, repair.model].filter(Boolean).join(" · ") || "—";

  const navItems: { key: Page; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: t("nav.dashboard"), icon: <LayoutDashboard size={17} /> },
    { key: "repairs",   label: t("nav.repairs"),   icon: <Wrench size={17} /> },
    { key: "customers", label: t("nav.customers"), icon: <Users size={17} /> },
    { key: "settings",  label: t("nav.settings"),  icon: <Settings size={17} /> },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/dbrepairs-icon.png" alt="" />
          <div>DBRepairs <span>0.2</span></div>
        </div>
        <nav>
          {navItems.map(({ key, label, icon }) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => setPage(key)}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-language">{languageControl}</div>
      </aside>

      <main>
        {page === "dashboard" && (
          <>
            <header>
              <div>
                <h1>{t("dashboard.title")}</h1>
                <p>{t("dashboard.subtitle")}</p>
              </div>
            </header>

            <section className="cards">
              {cards.map(({ key, value, icon, accent, accentL }) => (
                <article
                  className="card"
                  key={key}
                  style={{ "--card-accent": accent, "--card-accent-l": accentL } as React.CSSProperties}
                >
                  <div className="card-icon">{icon}</div>
                  <strong>{dashboardLoading ? "…" : value}</strong>
                  <span>{t(key)}</span>
                </article>
              ))}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{t("repairs.title")}</h2>
                  <p>{t("repairs.emptyHint")}</p>
                </div>
                <button className="primary" onClick={() => setPage("repairs")}>+ {t("repair.new")}</button>
              </div>

              {dashboardError ? (
                <div className="empty-state">{t("database.error")}</div>
              ) : recentRepairs.length === 0 ? (
                <div className="empty-state">{dashboardLoading ? "…" : t("repairs.empty")}</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("repair.number")}</th>
                        <th>{t("repair.customer")}</th>
                        <th>{t("repair.device")}</th>
                        <th>{t("repair.status")}</th>
                        <th>{t("repair.openedAt")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRepairs.map((repair) => (
                        <tr key={repair.id}>
                          <td><strong>{repair.repair_number}</strong></td>
                          <td>{repair.customer_name}</td>
                          <td>{deviceLabel(repair)}</td>
                          <td>
                            <span className={statusPillClass(repair.status_code)}>
                              {t(repair.status_label_key)}
                            </span>
                          </td>
                          <td className="muted">{new Date(repair.opened_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {page === "customers" && <CustomersPage />}
        {page === "repairs" && <RepairsPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
