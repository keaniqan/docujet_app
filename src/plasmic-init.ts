import { initPlasmicLoader } from "@plasmicapp/loader-nextjs/react-server-conditional";
import ServiceCard from "@/components/ServiceCard";
import Navbar from "@/components/Navbar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Hero from "@/components/Hero";
import ServicesSection from "@/components/ServicesSection";
import CallToAction from "@/components/CallToAction";
import Footer from "@/components/Footer";
import HomePage from "@/components/pages/HomePage";
import ServicesPage from "@/components/pages/ServicesPage";
import BookingPage from "@/components/pages/BookingPage";
import FAQPage from "@/components/pages/FAQPage";
import ContactPage from "@/components/pages/ContactPage";
import LoginPage from "@/components/pages/LoginPage";
import { faqItems, serviceItems } from "@/lib/site-data";

type PlasmicLoader = ReturnType<typeof initPlasmicLoader>;

/**
 * Builds a loader for one project.
 *
 * Extracted from the module-level `initPlasmicLoader` call so that the same
 * construction can happen again with credentials read from the database rather
 * than from the environment — see `getServerPlasmicLoader()` below.
 */
function createLoader(projectId: string, token: string): PlasmicLoader {
  const loader = initPlasmicLoader({
    projects: [{ id: projectId, token }],
    preview: true,
  });

  registerPublicComponents(loader);
  return loader;
}

/**
 * The loader the browser and the Studio host use.
 *
 * Still built from `process.env` at module load, and still exported: it is
 * imported by `plasmic-init-client.tsx` (which registers the admin components
 * on top of it) and by `/plasmic-host`. Neither needs a live credential —
 * `PLASMIC_PROJECT_ID` and `PLASMIC_API_TOKEN` are not `NEXT_PUBLIC_`, so in
 * the browser both are already `undefined` and the client renders from
 * prefetched data alone.
 */
export const PLASMIC = createLoader(
  process.env.PLASMIC_PROJECT_ID ?? "",
  process.env.PLASMIC_API_TOKEN ?? "",
);

/**
 * The loader the server fetches with.
 *
 * Credentials come from `resolveEnv`, so a project id typed into System Config
 * actually changes which Studio project the site renders — before this, the
 * stored values were saved and then read by nothing, and the settings form had
 * to carry a notice telling admins to go and edit `.env` as well.
 *
 * Memoized per credential pair rather than per request: constructing a loader
 * re-runs thirteen `registerComponent` calls, and the pair changes about as
 * often as somebody edits the settings page. Returns the module-level
 * `PLASMIC` unchanged when the resolved credentials are the environment ones,
 * which is the ordinary case and costs nothing.
 */
const loaderCache = new Map<string, PlasmicLoader>();

export async function getServerPlasmicLoader(): Promise<PlasmicLoader> {
  const { resolveEnvMany } = await import("@/lib/settings/resolve");
  const { PLASMIC_PROJECT_ID: projectId, PLASMIC_API_TOKEN: token } =
    await resolveEnvMany(["PLASMIC_PROJECT_ID", "PLASMIC_API_TOKEN"] as const);

  if (
    projectId === (process.env.PLASMIC_PROJECT_ID?.trim() ?? "") &&
    token === (process.env.PLASMIC_API_TOKEN?.trim() ?? "")
  ) {
    return PLASMIC;
  }

  const key = `${projectId}:${token}`;
  const cached = loaderCache.get(key);
  if (cached) return cached;

  const loader = createLoader(projectId, token);
  loaderCache.set(key, loader);
  return loader;
}

/**
 * Every public component Studio may insert.
 *
 * A function rather than thirteen statements at module scope, because a loader
 * built from database credentials needs exactly the same registrations and
 * duplicating them would be thirteen chances to register one on only one of
 * the two.
 */
function registerPublicComponents(loader: PlasmicLoader) {
  loader.registerComponent(ServiceCard, {
    name: "ServiceCard",
    displayName: "Service Card",
    props: {
      className: {
        type: "class",
      },
      title: {
        type: "string",
        defaultValue: "Service Title",
      },
      description: {
        type: "string",
        defaultValue: "Service description goes here.",
      },
      buttonText: {
        type: "string",
        defaultValue: "Learn More",
      },
      buttonUrl: {
        type: "string",
        defaultValue: "/booking",
      },
    },
  });

  loader.registerComponent(Navbar, {
    name: "Navbar",
    displayName: "Navbar",
    props: {
      className: {
        type: "class",
      },
    },
  });

  loader.registerComponent(AdminSidebar, {
    name: "AdminSidebar",
    displayName: "Admin Sidebar",
    props: {
      className: {
        type: "class",
      },
    },
  });

  loader.registerComponent(Hero, {
    name: "Hero",
    displayName: "Hero Section",
    props: {
      className: {
        type: "class",
      },
      eyebrow: {
        type: "string",
        defaultValue: "DocuJet Document Solutions",
      },
      title: {
        type: "string",
        defaultValue: "Smart Printing Solutions for Modern Businesses",
      },
      description: {
        type: "string",
        defaultValue:
          "DocuJet provides reliable printing, printer consultation, document solutions, product demonstrations, and business printing support.",
      },
      primaryButtonText: {
        type: "string",
        defaultValue: "Book an Appointment",
      },
      primaryButtonUrl: {
        type: "string",
        defaultValue: "/booking",
      },
      secondaryButtonText: {
        type: "string",
        defaultValue: "Explore Solutions",
      },
      secondaryButtonUrl: {
        type: "string",
        defaultValue: "/services",
      },
    },
  });

  loader.registerComponent(ServicesSection, {
    name: "ServicesSection",
    displayName: "Services Section",
    props: {
      className: {
        type: "class",
      },
      title: {
        type: "string",
        defaultValue: "WorkForce Enterprise Product Range",
      },
      description: {
        type: "string",
        defaultValue:
          "Explore the three Epson WorkForce Enterprise models and review the key product details highlighted in the brochure.",
      },
      // The real current 3 WF-C models, not a placeholder — so Studio's canvas
      // starts populated. This is captured once at registration time; it will
      // not retroactively follow later edits to site-data.ts, and once a Studio
      // editor touches the array, Studio's own stored value takes over from
      // this default entirely — normal Plasmic behavior, not a bug to fix.
      serviceItems: {
        type: "array",
        itemType: {
          type: "object",
          fields: {
            title: { type: "string" },
            description: { type: "string" },
            buttonText: { type: "string" },
            buttonUrl: { type: "string" },
          },
        },
        defaultValue: serviceItems,
      },
    },
  });

  loader.registerComponent(CallToAction, {
    name: "CallToAction",
    displayName: "Call To Action",
    props: {
      className: {
        type: "class",
      },
      title: {
        type: "string",
        defaultValue: "Book a consultation with DocuJet",
      },
      description: {
        type: "string",
        defaultValue:
          "Tell us what you need and we will prepare the right discussion, demonstration, or recommendation path for your business.",
      },
      buttonText: {
        type: "string",
        defaultValue: "Book Appointment",
      },
      buttonUrl: {
        type: "string",
        defaultValue: "/booking",
      },
    },
  });

  loader.registerComponent(Footer, {
    name: "Footer",
    displayName: "Footer",
    props: {
      className: {
        type: "class",
      },
      companyName: {
        type: "string",
        defaultValue: "DocuJet",
      },
      bookingLinkText: {
        type: "string",
        defaultValue: "Book Appointment",
      },
      bookingLinkUrl: {
        type: "string",
        defaultValue: "/booking",
      },
    },
  });

  loader.registerComponent(HomePage, {
    name: "HomePage",
    displayName: "DocuJet Home Page",
    props: {
      heroTitle: {
        type: "string",
        defaultValue: "Smart Printing Solutions for Modern Businesses",
      },
      heroDescription: {
        type: "string",
        defaultValue:
          "DocuJet provides reliable printing, printer consultation, document solutions, product demonstrations, and business printing support for organisations that need dependable output and clear guidance.",
      },
      primaryButtonText: {
        type: "string",
        defaultValue: "Book an Appointment",
      },
      primaryButtonUrl: {
        type: "string",
        defaultValue: "/booking",
      },
      secondaryButtonText: {
        type: "string",
        defaultValue: "Explore Solutions",
      },
      secondaryButtonUrl: {
        type: "string",
        defaultValue: "/services",
      },
      benefitsHeading: {
        type: "string",
        defaultValue:
          "Built for business printing decisions that need clarity and reliability",
      },
      whyChooseHeading: {
        type: "string",
        defaultValue:
          "A professional approach to printer consultation and document support",
      },
      faqHeading: {
        type: "string",
        defaultValue: "Common questions from businesses exploring DocuJet",
      },
      ctaTitle: {
        type: "string",
        defaultValue: "Ready to discuss your printing requirements?",
      },
      ctaDescription: {
        type: "string",
        defaultValue:
          "Book an appointment for consultation, product demonstrations, pricing discussions, or technical guidance.",
      },
      ctaButtonText: {
        type: "string",
        defaultValue: "Book Appointment",
      },
      ctaButtonUrl: {
        type: "string",
        defaultValue: "/booking",
      },
    },
  });

  loader.registerComponent(ServicesPage, {
    name: "ServicesPage",
    displayName: "DocuJet Services Page",
    props: {
      className: {
        type: "class",
      },
      pageTitle: {
        type: "string",
        defaultValue: "Epson WorkForce Enterprise WF-C20600, WF-C20750, and WF-C21000",
      },
      pageDescription: {
        type: "string",
        defaultValue:
          "Explore the Epson WorkForce Enterprise product range and review the key details for each model, including print speed, Heat-Free performance, finishing support, workflow compatibility, and enterprise-ready features.",
      },
      ctaTitle: {
        type: "string",
        defaultValue: "Need help choosing the right product?",
      },
      ctaDescription: {
        type: "string",
        defaultValue:
          "Book a product consultation to compare the WF-C20600, WF-C20750, and WF-C21000 based on output speed, media handling, finishing options, and deployment needs.",
      },
      ctaButtonText: {
        type: "string",
        defaultValue: "Book Product Consultation",
      },
      ctaButtonUrl: {
        type: "string",
        defaultValue: "/booking",
      },
    },
  });

  loader.registerComponent(BookingPage, {
    name: "BookingPage",
    displayName: "DocuJet Booking Page",
    props: {
      className: {
        type: "class",
      },
      pageTitle: {
        type: "string",
        defaultValue: "Schedule a consultation or product discussion with DocuJet",
      },
      pageDescription: {
        type: "string",
        defaultValue:
          "Use the form below to request a consultation, demonstration, pricing discussion, technical session, or after-sales support appointment.",
      },
      introTitle: {
        type: "string",
        defaultValue: "What to expect",
      },
    },
  });

  loader.registerComponent(FAQPage, {
    name: "FAQPage",
    displayName: "DocuJet FAQ Page",
    props: {
      className: {
        type: "class",
      },
      pageTitle: {
        type: "string",
        defaultValue: "Clear answers for businesses exploring DocuJet",
      },
      pageDescription: {
        type: "string",
        defaultValue:
          "Review common questions about appointments, demonstrations, printer recommendations, pricing discussions, business printing, and support.",
      },
      // The real current 7 Q&As, not placeholders — same "captured once, won't
      // retroactively follow site-data.ts, Studio's own value wins after a
      // first edit" caveat as ServicesSection's serviceItems above.
      faqItems: {
        type: "array",
        itemType: {
          type: "object",
          fields: {
            question: { type: "string" },
            answer: { type: "string" },
          },
        },
        defaultValue: faqItems,
      },
      ctaTitle: {
        type: "string",
        defaultValue: "Still need a tailored answer?",
      },
      ctaDescription: {
        type: "string",
        defaultValue:
          "Book an appointment and discuss your business requirements directly with DocuJet.",
      },
      ctaButtonText: {
        type: "string",
        defaultValue: "Book Appointment",
      },
      ctaButtonUrl: {
        type: "string",
        defaultValue: "/booking",
      },
    },
  });

  loader.registerComponent(ContactPage, {
    name: "ContactPage",
    displayName: "DocuJet Contact Page",
    props: {
      className: {
        type: "class",
      },
      pageTitle: {
        type: "string",
        defaultValue: "Speak with DocuJet about your printing and document needs",
      },
      pageDescription: {
        type: "string",
        defaultValue:
          "Use the contact form for general enquiries, or book an appointment if you already know the type of consultation you need.",
      },
      phone: {
        type: "string",
        defaultValue: "Phone placeholder - replace with official business number",
      },
      email: {
        type: "string",
        defaultValue: "Email placeholder - replace with official business email",
      },
      address: {
        type: "string",
        defaultValue: "Office location placeholder - replace with official address",
      },
      businessHours: {
        type: "string",
        defaultValue: "Business hours placeholder - replace with actual operating hours",
      },
      ctaText: {
        type: "string",
        defaultValue: "Book Appointment",
      },
      ctaUrl: {
        type: "string",
        defaultValue: "/booking",
      },
    },
  });

  loader.registerComponent(LoginPage, {
    name: "LoginPage",
    displayName: "DocuJet Login Page",
    props: {
      className: {
        type: "class",
      },
      shellClassName: {
        type: "class",
      },
      leftPanelClassName: {
        type: "class",
      },
      rightPanelClassName: {
        type: "class",
      },
    },
  });
}
