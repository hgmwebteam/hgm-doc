import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import {
    type ChatWidgetPageData,
    type ClientPageData,
    type DashboardPageData,
    type HostOnboardingPageData,
    type LeadCapturePageData,
    supabase,
} from "@/lib/supabase";
import { ChatWidgetScreen } from "@/pages/client/chat-widget-screen";
import { ClientDashboardPage } from "@/pages/client/client-dashboard-page";
import { AccessFormPage, type ClientOnboardingData, ClientOnboardingFormPage } from "@/pages/client/client-onboarding-form-page";
import { type ClientStage, KEEP_JOURNEY_SLUGS, fetchClientStage } from "@/pages/client/dashboard/client-stage";
import { fullDashboardSlug } from "@/pages/client/help/help-api";
import { HelpCenterScreen } from "@/pages/client/help/help-center-screen";
import { HostOnboardingFormPage } from "@/pages/client/host-onboarding-form-page";
import { PixelPage } from "@/pages/client/pixel-page";
import { PopupPage } from "@/pages/client/popup-page";
import { NotFound } from "@/pages/not-found";
import { TemplateOneScreen } from "@/pages/templates/template-one-screen";

type ClientOnboardingPageRow = {
    slug: string;
    client_name: string;
    client_website: string;
    data: Partial<ClientOnboardingData> | null;
    created_at?: string;
};

const Spinner = () => (
    <main className="flex min-h-dvh items-center justify-center bg-secondary">
        <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
    </main>
);

/* Lead-capture pages live at /{name}-leadcapture and load from leadcapture_pages. */
const LeadCaptureScreen = ({ slug }: { slug: string }) => {
    const [data, setData] = useState<LeadCapturePageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        setLoading(true);
        setData(null);
        setNotFound(false);
        supabase
            .from("leadcapture_pages")
            .select("*")
            .eq("slug", slug)
            .single()
            .then(({ data: row, error }) => {
                if (!error && row) setData(row as LeadCapturePageData);
                else setNotFound(true);
                setLoading(false);
            });
    }, [slug]);

    if (loading) return <Spinner />;
    if (notFound) return <NotFound />;

    return (
        <PopupPage
            key={slug}
            slug={slug}
            initialClientName={data?.client_name ?? ""}
            initialClientWebsite={data?.client_website ?? ""}
            initialPopupCode={data?.popup_code || undefined}
            initialInlineCode={data?.inline_form_code || undefined}
            initialPromoHeader={data?.promo_header || undefined}
            initialPromoDesc={data?.promo_desc || undefined}
            initialBeforeImg1={data?.before_img_1 ?? ""}
            initialAfterImg1={data?.after_img_1 ?? ""}
            initialBeforeImg2={data?.before_img_2 ?? ""}
            initialAfterImg2={data?.after_img_2 ?? ""}
            initialFormOption={data?.form_option || undefined}
            initialOptionBIntro={data?.option_b_intro || undefined}
            initialOptionBSteps={data?.option_b_steps?.length ? data.option_b_steps : undefined}
        />
    );
};

/* Chat-widget pages live at /{name}-chatwidget and load from chatwidget_pages. */
const ChatWidgetClientScreen = ({ slug }: { slug: string }) => {
    const [data, setData] = useState<ChatWidgetPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        setLoading(true);
        setData(null);
        setNotFound(false);
        supabase
            .from("chatwidget_pages")
            .select("*")
            .eq("slug", slug)
            .single()
            .then(({ data: row, error }) => {
                if (!error && row) setData(row as ChatWidgetPageData);
                else setNotFound(true);
                setLoading(false);
            });
    }, [slug]);

    if (loading) return <Spinner />;
    if (notFound) return <NotFound />;

    return (
        <ChatWidgetScreen
            key={slug}
            slug={slug}
            initialClientName={data?.client_name ?? ""}
            initialClientWebsite={data?.client_website ?? ""}
            initialWidgetId={data?.widget_id || undefined}
        />
    );
};

/* Host Onboarding Forms live at /{name}-hostonboarding and load from host_onboarding_pages. */
const HostOnboardingClientScreen = ({ slug }: { slug: string }) => {
    const [data, setData] = useState<HostOnboardingPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        setLoading(true);
        setData(null);
        setNotFound(false);
        supabase
            .from("host_onboarding_pages")
            .select("*")
            .eq("slug", slug)
            .single()
            .then(({ data: row, error }) => {
                if (!error && row) setData(row as HostOnboardingPageData);
                else setNotFound(true);
                setLoading(false);
            });
    }, [slug]);

    if (loading) return <Spinner />;
    if (notFound) return <NotFound />;

    return (
        <HostOnboardingFormPage
            key={slug}
            slug={slug}
            initialClientName={data?.client_name ?? ""}
            initialClientWebsite={data?.client_website ?? ""}
            initialData={data?.data}
        />
    );
};

/* Client dashboards live at /{name}-dashboard and load from dashboard_pages.
   The bare "/client-dashboard" slug is the master template (no DB row needed).

   Which dashboard depends on the Client List's status (client-stage.ts): an onboarding
   client gets the journey page below; an existing client's dashboard is their Help Centre,
   drawn inside the existing-client rail. `?view=full` opens the journey page for anyone,
   which is how the team's "Full dashboard" row gets there and how an AM still edits it. */
const ClientDashboardScreen = ({ slug }: { slug: string }) => {
    const [data, setData] = useState<DashboardPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [stage, setStage] = useState<ClientStage | null | undefined>(undefined);
    const [params] = useSearchParams();
    const wantFull = params.get("view") === "full";

    const isTemplate = slug === "client-dashboard";

    useEffect(() => {
        if (isTemplate) {
            setStage(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setData(null);
        setNotFound(false);
        setStage(undefined);
        void fetchClientStage(slug).then(setStage);
        supabase
            .from("dashboard_pages")
            .select("*")
            .eq("slug", slug)
            .single()
            .then(({ data: row, error }) => {
                if (!error && row) setData(row as DashboardPageData);
                else setNotFound(true);
                setLoading(false);
            });
    }, [slug, isTemplate]);

    if (loading || stage === undefined) return <Spinner />;
    if (notFound) return <NotFound />;
    if (stage === "existing" && !wantFull) return <HelpCenterScreen view="home" />;

    return (
        <ClientDashboardPage
            key={slug}
            slug={slug}
            isTemplate={isTemplate}
            initialClientName={data?.client_name ?? ""}
            initialClientWebsite={data?.client_website ?? ""}
            initialData={data?.data}
        />
    );
};

/* Onboarding Forms live at /{name}-onboarding and Account Access Forms at /{name}-access;
   both load from client_onboarding_pages. */
const ClientOnboardingScreen = ({ slug, access = false }: { slug: string; access?: boolean }) => {
    const [data, setData] = useState<ClientOnboardingPageRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        setLoading(true);
        setData(null);
        setNotFound(false);
        supabase
            .from("client_onboarding_pages")
            .select("*")
            .eq("slug", slug)
            .single()
            .then(({ data: row, error }) => {
                if (!error && row) setData(row as ClientOnboardingPageRow);
                else setNotFound(true);
                setLoading(false);
            });
    }, [slug]);

    if (loading) return <Spinner />;
    if (notFound) return <NotFound />;

    const Form = access ? AccessFormPage : ClientOnboardingFormPage;
    return <Form key={slug} slug={slug} initialClientName={data?.client_name ?? ""} initialData={data?.data} />;
};

export const ClientScreen = () => {
    const { clientSlug } = useParams<{ clientSlug: string }>();

    /* /{client}-help is the help centre's short address, as the owner wanted it typed:
       one segment, case does not matter. HelpCenterScreen reads the slug from the route and
       fullDashboardSlug() drops the "-help", so /flohom-help serves flohom-dashboard's help
       centre, inside the existing-client rail when that client is existing. First, so no
       other suffix rule can claim it. Not for the two dashboards pinned to the journey
       (owner, 16 Oct 2026: "don't build for Enjoy Unique Stays and FLOHOM"): those fall
       through to the 404 they have today. */
    if (clientSlug?.toLowerCase().endsWith("-help") && !KEEP_JOURNEY_SLUGS.has(fullDashboardSlug(clientSlug))) {
        return <HelpCenterScreen view="home" />;
    }
    if (clientSlug?.endsWith("-leadcapture")) {
        return <LeadCaptureScreen slug={clientSlug} />;
    }

    if (clientSlug?.endsWith("-chatwidget")) {
        return <ChatWidgetClientScreen slug={clientSlug} />;
    }

    if (clientSlug?.endsWith("-dashboard")) {
        return <ClientDashboardScreen slug={clientSlug} />;
    }

    if (clientSlug?.endsWith("-hostonboarding")) {
        return <HostOnboardingClientScreen slug={clientSlug} />;
    }

    // NOTE: must stay AFTER the "-hostonboarding" check — that suffix also ends with "-onboarding".
    if (clientSlug?.endsWith("-onboarding")) {
        return <ClientOnboardingScreen slug={clientSlug} />;
    }

    // Account Access Forms share client_onboarding_pages, one row per form.
    if (clientSlug?.endsWith("-access")) {
        return <ClientOnboardingScreen slug={clientSlug} access />;
    }

    return <PixelScreen clientSlug={clientSlug} />;
};

const PixelScreen = ({ clientSlug }: { clientSlug?: string }) => {
    const [data, setData] = useState<ClientPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    // Set when the slug isn't a pixel page but IS a template-1 document.
    const [isTemplateDoc, setIsTemplateDoc] = useState(false);
    // Set when the slug is the short form of a dashboard URL — see the lookup below.
    const [dashboardSlug, setDashboardSlug] = useState<string | null>(null);

    // "metapixel" is the template/create route and is always valid even without a saved row.
    const isTemplate = clientSlug === "metapixel";

    useEffect(() => {
        if (!clientSlug) {
            setNotFound(true);
            setLoading(false);
            return;
        }
        if (isTemplate) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setData(null);
        setNotFound(false);
        setIsTemplateDoc(false);
        setDashboardSlug(null);
        supabase
            .from("client_pages")
            .select("*")
            .eq("slug", clientSlug)
            .single()
            .then(({ data: row, error }) => {
                if (!error && row) {
                    setData(row as ClientPageData);
                    setLoading(false);
                    return;
                }
                // Not a pixel page — it might be a document copied from /template-1.
                supabase
                    .from("template_docs")
                    .select("slug")
                    .eq("slug", clientSlug)
                    .maybeSingle()
                    .then(({ data: doc }) => {
                        if (doc) {
                            setIsTemplateDoc(true);
                            setLoading(false);
                            return;
                        }
                        /* Last chance before 404: the slug is the short form of a dashboard URL
                           (/away2pa for /away2pa-dashboard). It used to serve the dashboard; since
                           16 Oct 2026 it sends the visitor to the portal's front door instead (owner:
                           "if someone tries /away2pa, take them to hgmportal.com/"). The dashboard is
                           reached by its full address only. Still looked up, so a slug that is nothing
                           at all stays a 404 rather than a redirect. */
                        supabase
                            .from("dashboard_pages")
                            .select("slug")
                            .eq("slug", `${clientSlug}-dashboard`)
                            .maybeSingle()
                            .then(({ data: dash }) => {
                                if (dash) setDashboardSlug(`${clientSlug}-dashboard`);
                                else setNotFound(true);
                                setLoading(false);
                            });
                    });
            });
    }, [clientSlug, isTemplate]);

    if (loading) return <Spinner />;
    if (isTemplateDoc && clientSlug) return <TemplateOneScreen key={clientSlug} slug={clientSlug} isTemplate={false} />;
    if (dashboardSlug) return <Navigate to="/" replace />;
    if (notFound) return <NotFound />;

    return (
        <PixelPage
            key={clientSlug}
            slug={clientSlug}
            isTemplate={isTemplate}
            initialClientName={data?.client_name ?? ""}
            initialClientWebsite={data?.client_website ?? ""}
            initialPixelCode={data?.pixel_code}
        />
    );
};
