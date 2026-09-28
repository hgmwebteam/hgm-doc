import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router";
import { AiChatWidget } from "@/components/application/ai-chat-widget";
import { HelpMenu } from "@/components/application/help-menu";
import { ThemeToggle } from "@/components/base/theme-toggle/theme-toggle";
import { useAuthUser } from "@/hooks/use-auth-user";
import { ChatWidgetScreen } from "@/pages/client/chat-widget-screen";
import { AccessFormPage, ClientOnboardingFormPage } from "@/pages/client/client-onboarding-form-page";
import { ClientScreen } from "@/pages/client/client-screen";
import { HelpCenterScreen } from "@/pages/client/help/help-center-screen";
import { HostOnboardingFormPage } from "@/pages/client/host-onboarding-form-page";
import { OwnerGuideScreen } from "@/pages/client/owner-guide-screen";
import { PopupPage } from "@/pages/client/popup-page";
import { LandingScreen } from "@/pages/landing-screen";
import { NotFound } from "@/pages/not-found";
import { ChatWidgetOverviewScreen } from "@/pages/overviews/chat-widget-overview-screen";
import { ClientDashboardOverviewScreen } from "@/pages/overviews/client-dashboard-overview-screen";
import { HomepageOverviewScreen } from "@/pages/overviews/homepage-overview-screen";
import { MasterDocumentLogScreen } from "@/pages/overviews/master-document-log-screen";
import { OwnerGuideOverviewScreen } from "@/pages/overviews/owner-guide-overview-screen";
import { WelcomeEmailFlowOverviewScreen } from "@/pages/overviews/welcome-email-flow-overview-screen";
import { SampleScreen } from "@/pages/sample-screen";
import { AiWebsiteSetupScreen } from "@/pages/team/ai-website-setup-screen";
import { AliciaFeedbackScreen } from "@/pages/team/alicia-feedback-screen";
import { AnimationScreen } from "@/pages/team/animation-screen";
import { BackgroundScreen } from "@/pages/team/background-screen";
import { ComponentLibraryArchitectureScreen } from "@/pages/team/component-library-architecture-screen";
import { DashboardScreen } from "@/pages/team/dashboard-screen";
import { DeploymentScreen } from "@/pages/team/deployment-screen";
import { DesignSystemScreen } from "@/pages/team/design-system-screen";
import { EmailPreviewScreen } from "@/pages/team/email-preview-screen";
import { HomeScreen } from "@/pages/team/home-screen";
import { HomeTwoScreen } from "@/pages/team/home-two-screen";
import { LogScreen } from "@/pages/team/log-screen";
import { LogScriptScreen } from "@/pages/team/log-script-screen";
import { ManualScreen } from "@/pages/team/manual-screen";
import { MockupIgScreen } from "@/pages/team/mockup-ig/mockup-ig-screen";
import { MockupScreen } from "@/pages/team/mockup/mockup-screen";
import { PromptLibraryScreen } from "@/pages/team/prompt-library-screen";
import { QuestionsScreen } from "@/pages/team/questions-screen";
import { ReadingYourClientsScreen } from "@/pages/team/reading-your-clients-screen";
import { RequestsScreen } from "@/pages/team/requests-screen";
import { RoadmapScreen } from "@/pages/team/roadmap-screen";
import { SafeBrowsingScreen } from "@/pages/team/safe-browsing-screen";
import { SettingsScreen } from "@/pages/team/settings-screen";
import { SopViewerScreen } from "@/pages/team/sops/sop-viewer-screen";
import { TestScreen } from "@/pages/team/test-screen";
import { TeamReportScreen, TeamTicketsScreen } from "@/pages/team/tickets-screen";
import { TemplateOneScreen } from "@/pages/templates/template-one-screen";
import { TemplateScreen } from "@/pages/templates/template-screen";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";
import "@/styles/globals.css";

// Internal app pages render their own theme chrome inside the icon rail, so the
// floating toggle is hidden there to avoid duplicates. The account avatar is NOT
// shown globally — it's a team-only settings shortcut that lives in the dashboard
// rail, and it must never appear on client-facing pages (owner guides, popups, etc.).
const PAGES_WITHOUT_FLOATING_CHROME = [
    "/team/tickets",
    "/team/tickets/new",
    "/designsystem",
    "/home",
    "/home2",
    "/dashboard",
    "/webteam/ai-website-setup",
    "/webteam/component-library-architecture",
    "/clients/reading-your-clients",
    "/template-1",
    "/welcome-email-flow-overview",
    "/prompt-library",
    "/settings",
    "/roadmap",
    "/chat-widget-overview",
    "/client-dashboard-overview",
    "/homepage-overview",
    "/master-document-log",
    "/questions",
    "/deployment",
    "/log-script",
    "/log",
    "/fix",
    "/manual",
    "/alicia-feedback",
];

// The floating "?" help menu is a team tool. It renders ONLY on internal team
// pages and is hidden on every client-facing page — all client slugs
// (`/{client}-leadcapture`, `-chatwidget`, `-metapixel`, `-dashboard`), owner
// guides, and the shareable templates (`/popup`, `/chat-widget`, `/metapixel`) —
// so it never appears on anything shared with a client.
//
// Pages that have the department icon rail dock Help there instead (see
// RailBottom in icon-rail.tsx / dashboard-screen.tsx) and get the AI chat
// widget in this floating slot instead — see PAGES_WITH_CHAT_WIDGET below.
const PAGES_WITH_HELP_MENU = ["/", "/requests", "/settings", "/designsystem", "/home2", "/template", "/prompt-library"];

// The AI chat widget takes over the floating bottom-right slot on pages that
// have the icon rail (Help moved into the rail there — see above).
const PAGES_WITH_CHAT_WIDGET = [
    "/home",
    "/dashboard",
    "/roadmap",
    "/webteam/ai-website-setup",
    "/template-1",
    "/welcome-email-flow-overview",
    "/chat-widget-overview",
    "/client-dashboard-overview",
    "/owner-guide-overview",
    "/homepage-overview",
    "/master-document-log",
    "/questions",
];

const GlobalThemeToggle = () => {
    const { pathname } = useLocation();
    const { hideFloatingToggle } = useTheme();
    // Owner-guide pages have their own theme toggle in the sidebar (incl. /owner-guide/:slug).
    // Dynamic template-doc slugs (e.g. /template-1 copies) self-report via hideFloatingToggle
    // since they can't be listed in the static array below.
    if (hideFloatingToggle || PAGES_WITHOUT_FLOATING_CHROME.includes(pathname) || pathname.startsWith("/owner-guide") || pathname.startsWith("/sop/"))
        return null;
    return <ThemeToggle />;
};

const GlobalHelpMenu = () => {
    const { pathname } = useLocation();
    if (!PAGES_WITH_HELP_MENU.includes(pathname)) return null;
    return <HelpMenu />;
};

const GlobalChatWidget = () => {
    const { pathname } = useLocation();
    if (!PAGES_WITH_CHAT_WIDGET.includes(pathname)) return null;
    return <AiChatWidget />;
};

// Global navigation hotkeys — Ctrl+B jumps to the team dashboard from anywhere.
// Gated to signed-in @hiddengem.media members (same gate as the help menu) so a
// client on an owner guide or popup page can never be pulled onto a team page.
const GlobalHotkeys = () => {
    const navigate = useNavigate();
    const { user } = useAuthUser();
    const isTeam = !!user?.email && user.email.toLowerCase().endsWith("@hiddengem.media");

    useEffect(() => {
        if (!isTeam) return;
        const onKey = (e: KeyboardEvent) => {
            const el = document.activeElement as HTMLElement | null;
            const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
            if (typing || !e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
            if (e.key === "b" || e.key === "B") {
                e.preventDefault();
                navigate("/dashboard");
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isTeam, navigate]);

    return null;
};

// `/` — the public landing page for clients, the team dashboard for us.
//
// A signed-in @hiddengem.media member arriving at the root almost never wants the
// marketing splash, so they go straight to the Client List — the same destination
// as the Ctrl+B hotkey above, so the two can't disagree. `?public` opts out, so
// the team can still see exactly what a client sees without signing out.
//
// Rendering waits for `loading` instead of showing the landing right away: that
// keeps a team member from seeing the splash for a beat before being yanked off
// it. The cost is a brief blank for everyone, which is the right trade here —
// clients reach their material through private per-client URLs, so `/` is
// overwhelmingly a team entry point.
const RootScreen = () => {
    const { user, loading } = useAuthUser();
    const [params] = useSearchParams();
    const isTeam = !!user?.email && user.email.toLowerCase().endsWith("@hiddengem.media");

    if (loading) return null;
    if (isTeam && !params.has("public")) return <Navigate to="/dashboard" replace />;
    return <LandingScreen />;
};

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <RouteProvider>
                    <GlobalThemeToggle />
                    <GlobalHelpMenu />
                    <GlobalChatWidget />
                    <GlobalHotkeys />
                    <Routes>
                        <Route path="/" element={<RootScreen />} />

                        <Route path="/template" element={<TemplateScreen />} />
                        <Route path="/home" element={<HomeScreen />} />
                        <Route path="/dashboard" element={<DashboardScreen />} />
                        {/* Team-only: one SOP, read from the private `sops` bucket. Behind TeamGate + Google session. */}
                        <Route path="/sop/:id" element={<SopViewerScreen />} />
                        <Route path="/webteam/ai-website-setup" element={<AiWebsiteSetupScreen />} />
                        <Route path="/webteam/component-library-architecture" element={<ComponentLibraryArchitectureScreen />} />
                        <Route path="/clients/reading-your-clients" element={<ReadingYourClientsScreen />} />
                        <Route path="/template-1" element={<TemplateOneScreen />} />
                        <Route path="/welcome-email-flow-overview" element={<WelcomeEmailFlowOverviewScreen />} />
                        <Route path="/prompt-library" element={<PromptLibraryScreen />} />
                        <Route path="/owner-guide" element={<OwnerGuideScreen />} />
                        <Route path="/owner-guide/:slug" element={<OwnerGuideScreen />} />
                        <Route path="/popup" element={<PopupPage />} />
                        <Route path="/brand-vision-form" element={<HostOnboardingFormPage />} />
                        {/* Legacy alias — the template's old URL; links in the wild still resolve. */}
                        <Route path="/host-onboarding-form" element={<HostOnboardingFormPage />} />
                        <Route path="/client-onboarding-form" element={<ClientOnboardingFormPage />} />
                        <Route path="/access-form" element={<AccessFormPage />} />
                        <Route path="/requests" element={<RequestsScreen />} />
                        {/* Client requests, for the team: every client's, and the form that raises one. */}
                        <Route path="/team/tickets" element={<TeamTicketsScreen />} />
                        <Route path="/team/tickets/new" element={<TeamReportScreen />} />
                        <Route path="/designsystem" element={<DesignSystemScreen />} />
                        <Route path="/home2" element={<HomeTwoScreen />} />
                        <Route path="/settings" element={<SettingsScreen />} />
                        <Route path="/roadmap" element={<RoadmapScreen />} />
                        <Route path="/deployment" element={<DeploymentScreen />} />
                        <Route path="/fix" element={<SafeBrowsingScreen />} />
                        <Route path="/manual" element={<ManualScreen />} />
                        {/* Team-only log of what Alicia asks for and what we did. */}
                        <Route path="/alicia-feedback" element={<AliciaFeedbackScreen />} />
                        <Route path="/test" element={<TestScreen />} />
                        {/* The motion reference — team-internal, like /test. */}
                        <Route path="/animation" element={<AnimationScreen />} />
                        <Route path="/mockup-ig" element={<MockupIgScreen />} />
                        <Route path="/mockup" element={<MockupScreen />} />
                        <Route path="/background" element={<BackgroundScreen />} />
                        <Route path="/log-script" element={<LogScriptScreen />} />
                        {/* Who changed what on which client dashboard. Team-only by RLS; the
                            page gates on sign-in before it reads. */}
                        <Route path="/log" element={<LogScreen />} />
                        <Route path="/chat-widget" element={<ChatWidgetScreen isTemplate />} />
                        <Route path="/chat-widget-overview" element={<ChatWidgetOverviewScreen />} />
                        <Route path="/client-dashboard-overview" element={<ClientDashboardOverviewScreen />} />
                        <Route path="/owner-guide-overview" element={<OwnerGuideOverviewScreen />} />
                        <Route path="/homepage-overview" element={<HomepageOverviewScreen />} />
                        <Route path="/master-document-log" element={<MasterDocumentLogScreen />} />
                        <Route path="/questions" element={<QuestionsScreen />} />
                        {/* Public sample page. Must stay above the client-slug catch-all: otherwise
                            `/sample` is read as a client slug and rendered as a Meta Pixel page. */}
                        <Route path="/sample" element={<SampleScreen />} />
                        {/* Team-only: every welcome-flow email, rendered from the DB. Behind TeamGate. */}
                        <Route path="/email-preview" element={<EmailPreviewScreen />} />
                        {/* The client help centre. Three routes rather than one with a splat, so the
                            view is named here instead of being re-derived from the path inside the
                            screen, and so `/help/requests` can never be read as a reference.

                            Safe above the `/:clientSlug` catch-all below: that pattern matches a
                            SINGLE segment, so it was never going to swallow a two-segment path in
                            the first place — the risk is the `*` at the bottom, and React Router
                            ranks a static segment above a splat, so `/x-dashboard/help` lands here
                            and not on NotFound. Kept adjacent to the catch-all anyway, because the
                            next person to add a client route will read these two lines together. */}
                        <Route path="/:clientSlug/help" element={<HelpCenterScreen view="home" />} />
                        <Route path="/:clientSlug/help/requests" element={<HelpCenterScreen view="list" />} />
                        <Route path="/:clientSlug/help/requests/:reference" element={<HelpCenterScreen view="detail" />} />
                        <Route path="/:clientSlug/help/guides/:guide" element={<HelpCenterScreen view="guide" />} />
                        <Route path="/:clientSlug" element={<ClientScreen />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </RouteProvider>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
