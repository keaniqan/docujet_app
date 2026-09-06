/**
 * The content store's fallback — and, until an admin edits something, its only
 * source of truth.
 *
 * Every value here is the string the site already shipped, moved rather than
 * rewritten, so turning the CMS on changes nothing a visitor sees. Where a
 * value already had one home — `site-data.ts`'s arrays, `outreach.ts`'s drafts
 * — it is imported rather than copied, so there is still exactly one place it
 * lives.
 */

import {
  benefitItems,
  bookingProducts,
  bookingTypes,
  faqItems,
  serviceItems,
  whyChooseItems,
} from "@/lib/site-data";
import { DEFAULT_CAPTURE_COPY } from "@/lib/chat/capture-copy";
import { DEFAULT_OUTREACH_TEMPLATES } from "@/lib/crm/outreach-templates";
import type { SiteContent } from "./types";

export const DEFAULT_CONTENT: SiteContent = {
  // Nothing shipped: the site has never had social links, and an empty list is
  // the honest starting point rather than three dead placeholder URLs.
  social: { links: [] },

  landing: {
    heroEyebrow: "Epson WorkForce Enterprise",
    heroTitle: "Shaping the Future of Business Printing with Heat-Free Technology",
    heroDescription:
      "Powered by Epson Heat-Free Technology, the WorkForce Enterprise WF-C20600, WF-C20750, and WF-C21000 provide consistent high-speed printing, lower power consumption, and fewer replacement parts for demanding business environments.",
    primaryButtonText: "Book a Product Consultation",
    primaryButtonUrl: "/booking",
    secondaryButtonText: "Explore the Models",
    secondaryButtonUrl: "/services",

    benefitsEyebrow: "Key Benefits",
    benefitsHeading:
      "Built around enterprise speed, low intervention, and Heat-Free efficiency",

    servicesHeading: "WorkForce Enterprise Product Range",
    servicesDescription:
      "Explore the three Epson WorkForce Enterprise models and review the key product details highlighted in the brochure, including speed, Heat-Free printing, finishing support, and enterprise workflow readiness.",

    whyChooseEyebrow: "Why Choose DocuJet",
    whyChooseHeading: "Why organisations choose the WorkForce Enterprise platform",
    whyChooseBody:
      "DocuJet is positioned for businesses that want practical guidance, suitable technology, and a smoother path from exploration to support.",
    whyChooseItems: [...whyChooseItems],

    ctaTitle: "Ready to review the right model for your print volume?",
    ctaDescription:
      "Book a consultation to compare the WF-C20600, WF-C20750, and WF-C21000, review finishing options, and plan the right deployment approach.",
    ctaButtonText: "Book Consultation",
    ctaButtonUrl: "/booking",

    faqEyebrow: "FAQ Preview",
    faqHeading: "Common questions about the Epson WorkForce Enterprise range",
  },

  catalog: {
    benefits: benefitItems.map((item) => ({ ...item })),
    services: serviceItems.map((item) => ({ ...item })),
    faq: faqItems.map((item) => ({ ...item })),
    bookingProducts: [...bookingProducts],
    bookingTypes: [...bookingTypes],
  },

  // Was one template literal in src/lib/email.ts. The placeholders are the
  // values that were interpolated there, and they carry the same names.
  bookingEmail: {
    subject: "Appointment confirmed - {date}",
    html:
      "<p>Hello {name},</p>" +
      "<p>Your appointment has been confirmed.</p>" +
      "<p><strong>Appointment type:</strong> {type}<br />" +
      "<strong>Date:</strong> {date}<br />" +
      "<strong>Time:</strong> {time}<br />" +
      "<strong>Booking ID:</strong> {bookingId}</p>" +
      "<p>Please contact us if you need to reschedule.</p>" +
      "<p>Regards,<br />{sender}</p>",
  },

  chatCapture: DEFAULT_CAPTURE_COPY,

  outreach: DEFAULT_OUTREACH_TEMPLATES,

  // Sparse by design — see the note on TooltipOverrides.
  tooltips: {},
};
