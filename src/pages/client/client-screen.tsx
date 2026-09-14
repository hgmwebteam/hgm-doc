import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { PixelPage } from "@/pages/client/pixel-page";
import { PopupPage } from "@/pages/client/popup-page";
import { ClientDashboardPage } from "@/pages/client/client-dashboard-page";
import { HostOnboardingFormPage } from "@/pages/client/host-onboarding-form-page";
import { ClientOnboardingFormPage, type ClientOnboardingData } from "@/pages/client/client-onboarding-form-page";
import { TemplateOneScreen } from "@/pages/templates/template-one-screen";
import { NotFound } from "@/pages/not-found";
import { supabase, type ClientPageData, type DashboardPageData, type HostOnboardingPageData, type LeadCapturePageData } from "@/lib/supabase";

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
   The bare "/client-dashboard" slug is the master template (no DB row needed). */
const ClientDashboardScreen = ({ slug }: { slug: string }) => {
    const [data, setData] = useState<DashboardPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const isTemplate = slug === "client-dashboard";

    useEffect(() => {
        if (isTemplate) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setData(null);
        setNotFound(false);
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

    if (loading) return <Spinner />;
    if (notFound) return <NotFound />;

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

/* Host Onboarding Forms (the client's FIRST form, before Brand Vision) live at
   /{name}-onboarding and load from client_onboarding_pages. */
const ClientOnboardingScreen = ({ slug }: { slug: string }) => {
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

    return <ClientOnboardingFormPage key={slug} slug={slug} initialClientName={data?.client_name ?? ""} initialData={data?.data} />;
};

export const ClientScreen = () => {
    const { clientSlug } = useParams<{ clientSlug: string }>();

    if (clientSlug?.endsWith("-leadcapture")) {
        return <LeadCaptureScreen slug={clientSlug} />;
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
                        /* Last chance before 404: treat the slug as the short form of a dashboard
                           URL, so /north-star-resort-lodge serves /north-star-resort-lodge-dashboard.
                           Clients get a clean link with no per-client setup. Runs last so it can only
                           ever turn a 404 into a page — a real pixel page or template doc still wins. */
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
    /* The full "-dashboard" slug is passed through, not the short one the visitor typed, so edits
       still save back to the row they came from. */
    if (dashboardSlug) return <ClientDashboardScreen key={dashboardSlug} slug={dashboardSlug} />;
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
