/**
 * Single typed source of truth for ALL UI copy (English).
 *
 * Ported verbatim from the former `messages/en/*.json` namespaces.
 * Consumed through the `useTranslations` / `getTranslations` shim in
 * `src/lib/strings.ts` (dot-path resolution + {var} interpolation + a tiny
 * ICU plural resolver). Organized by the same namespaces as before:
 * common, navigation, cart, checkout, payment, validation, reviews, footer,
 * popup, product, home, badges, account.
 *
 * Side effects: none (pure data).
 */

export const strings = {
  "common": {
    "actions": {
      "home": "Home",
      "back": "Back",
      "continue": "Continue",
      "cancel": "Cancel",
      "close": "Close",
      "save": "Save",
      "edit": "Edit",
      "delete": "Delete",
      "send": "Send",
      "retry": "Try again",
      "loading": "Loading...",
      "error": "Error",
      "success": "Success",
      "backToProducts": "← Back to products",
      "modify": "Edit"
    },
    "trademark": {
      "label": "Designed with passion.",
      "compact": "Acme Store® is a registered trademark — no. <strong>{regNumber}</strong> (trademark <strong>{markNumber}</strong>), valid until {expiresAt}. Holder: {holder}.",
      "eyebrow": "Registered trademark",
      "title": "Acme Store is a registered trademark",
      "intro": "The <strong>Acme Store</strong> brand is a registered trademark. Use of the name, logo, or figurative elements visible on this site is protected by law.",
      "labels": {
        "holder": "Trademark holder",
        "representative": "Representative",
        "registrationNumber": "Registration number",
        "registrationDate": "Registration date",
        "trademarkNumber": "Trademark number",
        "procedureCompleted": "Date of registration",
        "type": "Trademark type",
        "colors": "Claimed colours",
        "viennaClasses": "Vienna classes",
        "niceClasses": "Nice classes",
        "registeredFrom": "Registered from",
        "expiresAt": "Valid until"
      }
    },
    "countdown": {
      "days": "DAYS",
      "hours": "HOURS",
      "minutes": "MIN",
      "seconds": "SEC"
    },
    "cookies": {
      "title": "Cookie settings",
      "intro": "We use cookies to remember your basket, show you personalised offers, and improve your shopping experience. Essential cookies are always active. For analytics and marketing, we ask for your consent.",
      "customizeTitle": "Customise cookies",
      "customizeIntro": "Choose the categories you'd like to enable. You can change your preferences at any time via the ",
      "customizeIntroLink": "Cookie settings",
      "customizeIntroSuffix": " link at the bottom of the page.",
      "necessary": "Strictly necessary",
      "necessaryDesc": "Required for the basket, authentication, and payment. Cannot be disabled.",
      "alwaysOn": "Always on",
      "analytics": "Analytics",
      "analyticsDesc": "Google Analytics — helps us understand which products visitors are looking for.",
      "marketing": "Marketing",
      "marketingDesc": "Meta Pixel — measures ad performance and shows you relevant offers.",
      "acceptAll": "Accept all",
      "declineAll": "Decline all",
      "customize": "Customise",
      "savePreferences": "Save my preferences",
      "settingsLink": "Cookie settings"
    },
    "categoryHeader": {
      "furniture": {
        "eyebrow": "FURNITURE",
        "title": "Solid-wood furniture",
        "subtitle": "Minimal, durable pieces in solid oak — nightstands, console tables and more for every room."
      },
      "lighting": {
        "eyebrow": "LIGHTING",
        "title": "Lighting collection",
        "subtitle": "Table and floor lamps in glass, brass and marble — dimmable warm light for any space."
      },
      "outdoor": {
        "eyebrow": "OUTDOOR",
        "title": "Outdoor & garden",
        "subtitle": "Solar-powered path and garden lighting — wire-free, weatherproof and easy to install."
      }
    },
    "notFound": {
      "code": "404",
      "heading": "Page not found",
      "body": "The link you followed is incorrect, has expired, or the page has been moved. Let's get you back on track.",
      "ctaHome": "Back to home",
      "exploreLabel": "Or explore the collection",
      "categories": {
        "furniture": "Furniture",
        "lighting": "Lighting",
        "outdoor": "Outdoor"
      }
    },
    "contact": {
      "form": {
        "intro": "Fill in the form and we'll get back to you promptly and helpfully.",
        "firstName": "First name",
        "firstNamePlaceholder": "First name",
        "lastName": "Last name",
        "lastNamePlaceholder": "Last name",
        "email": "Email address",
        "emailPlaceholder": "name@email.com",
        "phone": "Phone number",
        "phonePlaceholder": "+44 ...",
        "subject": "Subject",
        "subjectPlaceholder": "What would you like to ask us about?",
        "message": "Message",
        "messagePlaceholder": "Write your message…",
        "submit": "Send",
        "submitting": "Sending…",
        "success": "✓ Thank you! Your message has been sent. We'll get back to you as soon as possible.",
        "errorGeneric": "The message could not be sent.",
        "errorNetwork": "Connection failed. Please try again."
      }
    },
    "seo": {
      "siteName": "Acme Store",
      "titleTemplate": "%s — Acme Store",
      "home": {
        "title": "Spring Sale 2026 — Acme Store | Furniture, Lighting & Outdoor",
        "description": "Spring Sale 2026 at Acme Store. Solid-wood furniture, table and floor lamps, plus wire-free solar outdoor lighting — genuine discounts and fast delivery."
      },
      "layout": {
        "title": "Acme Store — Furniture, Lighting & Premium Outdoor",
        "description": "Acme Store — premium home collection. Solid-wood furniture, decorative lighting, and solar outdoor lighting. Delivery to the UK.",
        "ogTitle": "Acme Store — The collection for your home",
        "ogDescription": "Solid-wood furniture, decorative lighting, and solar outdoor lighting.",
        "keywords": "solid wood furniture, decorative lighting, table lamps, floor lamps, solar outdoor lighting, Acme Store"
      },
      "despreNoi": {
        "title": "About us — Acme Store",
        "description": "Acme Store — passionate about premium home products. Our team's mission, vision, and values."
      },
      "cumComand": {
        "title": "How to order — Acme Store",
        "description": "Step by step: how to choose a product, place an order, and track payment and delivery on shop.example.com."
      },
      "contact": {
        "title": "Contact — Acme Store",
        "description": "Let's talk. Send us a message and we'll get back to you quickly by email or phone."
      },
      "politicaRetur": {
        "title": "Returns policy — Acme Store",
        "description": "Acme Store returns policy: 14 days to return a product, conditions and steps to follow."
      },
      "politicaConfidentialitate": {
        "title": "Privacy policy — Acme Store",
        "description": "How we collect, process, and protect your personal data."
      },
      "termeniConditii": {
        "title": "Terms and conditions — Acme Store",
        "description": "Terms and conditions for using the site and purchasing Acme Store products."
      },
      "comanda": {
        "title": "My basket — Acme Store",
        "description": "Review the items in your basket and proceed to secure payment with Acme Store."
      },
      "checkout": {
        "title": "Checkout — Acme Store",
        "description": "Complete your Acme Store order — secure card payment and fast delivery."
      },
      "confirmare": {
        "title": "Order confirmed — Acme Store"
      },
      "furniture": {
        "title": "Furniture — Solid-wood collection",
        "description": "Minimal solid-oak furniture — nightstands, console tables and more, built to last."
      },
      "lighting": {
        "title": "Lighting — Lamps in glass, brass & marble",
        "description": "Dimmable table and floor lamps with warm light for every room."
      },
      "outdoor": {
        "title": "Outdoor — Solar garden lighting",
        "description": "Wire-free solar path and garden lights — weatherproof and easy to install."
      }
    }
  },
  "navigation": {
    "logoAria": "Home",
    "home": "Home",
    "categories": "Categories",
    "despreNoi": "About us",
    "contact": "Contact us",
    "openMenu": "Open menu",
    "closeMenu": "Close menu",
    "search": "Search",
    "account": "Account",
    "searchPlaceholder": "Search products...",
    "searchClear": "Clear search",
    "searchNoResults": "No products match your search.",
    "menuItems": {
      "home": "Home",
      "furniture": "Furniture",
      "lighting": "Lighting",
      "outdoor": "Outdoor",
      "account": "My account",
      "despreNoi": "About us",
      "contact": "Contact"
    },
    "categoryLinks": {
      "furniture": {
        "label": "Furniture",
        "description": "Solid-wood pieces for every room"
      },
      "lighting": {
        "label": "Lighting",
        "description": "Lamps that set the mood"
      },
      "outdoor": {
        "label": "Outdoor",
        "description": "Garden & solar lighting"
      }
    },
    "whatsappAria": "Contact us on WhatsApp",
    "whatsappFloatingMessage": "Hello! I'm interested in your products."
  },
  "cart": {
    "iconAria": "Basket ({count, plural, one {# item} other {# items}})",
    "title": "🛒 Your basket ({count})",
    "close": "Close basket",
    "empty": "Your basket is empty.",
    "emptyHint": "Add Acme Store products to get started.",
    "decreaseQuantity": "Decrease quantity",
    "increaseQuantity": "Increase quantity",
    "removeItem": "Remove item",
    "removeTitle": "Remove",
    "subtotal": "Subtotal",
    "shipping": "Delivery",
    "shippingFree": "Free",
    "freeShippingRemaining": "Add <strong>{amount}</strong> more to qualify for free delivery.",
    "freeShippingRemainingAria": "Add {amount} more to qualify for free delivery",
    "freeShippingActive": "Delivery is free for this order.",
    "freeShippingActiveAria": "Free delivery is active",
    "total": "Total",
    "freeShippingHint": "🚚 Free delivery from {amount}",
    "checkout": "Proceed to checkout",
    "continueShopping": "Continue shopping",
    "page": {
      "emptyTitle": "Your basket is empty",
      "emptyHint": "Browse our collection.",
      "viewSafes": "View collection",
      "title": "My basket",
      "decrease": "Decrease",
      "increase": "Increase",
      "remove": "Remove",
      "couponApplied": "Code applied",
      "couponLine": "{code} (-{percent}%)",
      "welcomeDiscount": "Welcome discount (-{percent}%)",
      "shippingWithFreeNote": "(free above {amount})",
      "upsellTitle": "Complete your order",
      "upsellAdd": "+ Add",
      "continueCheckout": "Proceed to payment"
    }
  },
  "checkout": {
    "pageTitle": "Checkout",
    "emptyCart": {
      "title": "Your basket is empty",
      "hint": "Add Acme Store products to continue"
    },
    "steps": {
      "email": "📧 Your email",
      "emailDone": "📧 Email",
      "shipping": "📦 Delivery address",
      "payment": "💳 Payment"
    },
    "edit": "Edit",
    "editShipping": "Edit",
    "emailIntro": "We save your email to send you your order confirmation and delivery updates. You'll complete the remaining details at the next step.",
    "fields": {
      "emailRequired": "Email *",
      "emailPlaceholder": "name@email.com",
      "billingType": "Billing type",
      "individual": "Individual",
      "company": "Business",
      "companyName": "Company name *",
      "companyNamePlaceholder": "Example Ltd",
      "companyCui": "Company registration number *",
      "companyCuiPlaceholder": "12345678",
      "companyRegCom": "Companies House number *",
      "companyRegComPlaceholder": "OC123456",
      "firstName": "First name *",
      "firstNamePlaceholder": "Jane",
      "lastName": "Last name *",
      "lastNamePlaceholder": "Smith",
      "phone": "Phone *",
      "phonePlaceholder": "+44 7xxx xxxxxx",
      "address": "Address *",
      "addressPlaceholder": "10 Example Street, Flat 5",
      "city": "City *",
      "cityPlaceholder": "London",
      "county": "County *",
      "countyPlaceholder": "Greater London",
      "country": "Country *",
      "postalCode": "Postcode *",
      "postalCodePlaceholder": "SW1A 1AA",
      "useAltShipping": "Deliver to a different address",
      "altAddressTitle": "Delivery address",
      "altAddressPlaceholder": "10 Example Street"
    },
    "actions": {
      "savingEmail": "Saving…",
      "continueEmail": "Continue →",
      "continueToPayment": "Continue to payment →",
      "processing": "Processing...",
      "codLong": "Pay on delivery — {total}",
      "confirmCod": "Confirm order — pay on delivery — {total}"
    },
    "summary": {
      "title": "📋 Order summary",
      "subtotal": "Subtotal",
      "welcomeDiscount": "🎁 Welcome discount (-{percent}%)",
      "couponBadge": "Code applied",
      "couponLine": "{code} (-{percent}%)",
      "couponMismatch": "Your code <strong>{code}</strong> is linked to a different email address ({email}). Use the same email at checkout to receive the {percent}% discount.",
      "shipping": "Delivery",
      "shippingFree": "Free",
      "shippingFreeNote": "(free above {amount})",
      "total": "Total",
      "shippingSummaryDeliverTo": "Delivering to:",
      "shippingSummaryCompany": "Company reg: {cui} · Companies House: {regcom}"
    },
    "payment": {
      "selectMethod": "Choose your payment method",
      "online": "Pay online",
      "onlineMeta": "Card / Revolut Pay",
      "cod": "Pay on delivery",
      "codMeta": "On receipt",
      "codNote": "You pay the courier when your order arrives at your address.",
      "or": "or",
      "title": "Payment"
    },
    "errors": {
      "invalidEmail": "Please enter a valid email address.",
      "verifyShipping": "Please check your delivery details.",
      "orderProcessing": "Error processing your order",
      "generic": "An error occurred. Please try again."
    },
    "unavailable": {
      "title": "Orders not available for this area",
      "body": "Orders are not yet available in this area. Please contact us to complete your purchase.",
      "cta": "Back to home"
    }
  },
  "payment": {
    "notConfigured": "Card payment is not configured — missing",
    "walletNotice": "Enter your delivery address to activate Revolut Pay, Apple Pay, and Google Pay.",
    "dividerOrCard": "or pay by card",
    "cardHintNoShipping": "Enter your delivery address to pay by card.",
    "cardHintIdle": "Click to open the secure form and pay by card.",
    "cardHintReady": "Details are locked for this payment session. If you change your basket, the form will be reset.",
    "cardHintPreparing": "Preparing the secure card payment form...",
    "processing": "Processing...",
    "payCard": "Pay {total} by card",
    "errors": {
      "shippingRequired": "Please enter your delivery address before paying.",
      "cannotInitiate": "Unable to initiate payment.",
      "revolutPayFailed": "Revolut Pay payment failed.",
      "walletFailed": "Wallet payment failed.",
      "cardFailed": "Card payment failed.",
      "completeAddressAndWait": "Please complete your address and wait for the form to load."
    }
  },
  "validation": {
    "firstNameRequired": "First name is required",
    "lastNameRequired": "Last name is required",
    "emailInvalid": "Invalid email address",
    "phoneInvalid": "Invalid phone number",
    "countyRequired": "County is required",
    "cityRequired": "City is required",
    "addressRequired": "Address is required",
    "countryRequired": "Country is required",
    "postalCodeRequired": "Postcode is required",
    "companyNameRequired": "Company name is required",
    "companyCuiRequired": "Company registration number is required",
    "companyRegComRequired": "Companies House number is required",
    "altAddressRequired": "Delivery address is required",
    "couponInvalid": "Invalid discount code",
    "orderItemsRequired": "Your order must contain at least one item"
  },
  "reviews": {
    "summaryAria": "Reviews summary",
    "summaryTitle": "Customer reviews",
    "averageOf5": "{value} out of 5",
    "totalReviews": "{count} reviews in total",
    "starsLine": "{star} stars",
    "starsAriaValue": "{value} out of 5 stars",
    "ctaWriteIntro": "Share your opinion",
    "writeReview": "Write a review",
    "writeReviewAria": "Write a review",
    "topicsAria": "What customers are saying",
    "topicsTitle": "What customers appreciate",
    "selectAspect": "Select an aspect",
    "topicAll": "All",
    "topicChipAria": "{label} — {count} mentions, {sentiment} sentiment",
    "autoGenerated": "Automatically generated from review text.",
    "galleryAria": "Reviews with photos",
    "galleryTitle": "Reviews with photos",
    "openImage": "Open image {index} of {total}",
    "closeLightbox": "Close",
    "previousImage": "Previous image",
    "nextImage": "Next image",
    "listAria": "Top reviews",
    "topReviewsTitle": "Top-rated reviews",
    "topicReviewsTitle": "Reviews about {topic}",
    "firstReviewTitle": "Be the first to leave a review",
    "topicNote": "Reviews mentioning this aspect are shown first.",
    "viewMore": "View more ({count})",
    "openReviewImage": "Open image {index} from {name}'s review",
    "reviewedInRomania": "Review published on {date}",
    "verifiedPurchase": "Verified purchase",
    "variantColor": "Colour: {value}",
    "variantSize": "Size: {value}",
    "variantQuantity": "Quantity: {value}",
    "helpfulCount": "{count, plural, one {# person found this review helpful} other {# people found this review helpful}}",
    "helpful": "Helpful",
    "thankYou": "Thank you!",
    "report": "Report",
    "reported": "✓ Review reported — thank you",
    "form": {
      "openCta": "✍ Add a review",
      "successTitle": "Thank you! Your review has been submitted and will appear on the site after verification.",
      "errorSubmit": "Something went wrong. Please try again.",
      "close": "Close",
      "title": "Write a review",
      "yourName": "Your name",
      "ratingLegend": "How satisfied are you?",
      "ratingAria": "Rating",
      "starsCount": "{count, plural, one {# star} other {# stars}}",
      "titleField": "Title (optional)",
      "titlePlaceholder": "e.g. Excellent quality",
      "comment": "Comment",
      "commentPlaceholder": "Tell us what you liked or what you'd improve.",
      "emailField": "Email (optional)",
      "emailPlaceholder": "name@email.com",
      "errorName": "Please enter your name.",
      "errorComment": "Your comment must be at least 10 characters.",
      "cancel": "Cancel",
      "submit": "Submit review"
    },
    "summaries": {
      "oslo-nightstand": "Customers love the solid oak feel and the quiet push-to-open drawer — and how quick it is to assemble.",
      "aria-console": "Reviewers praise the slim profile and the matching oak grain — a versatile piece for hallways and living rooms.",
      "halo-table-lamp": "A favourite for its soft opal glow and the stepless touch dimmer that remembers your last setting.",
      "lumen-floor-lamp": "Buyers highlight the stable marble base and how the arc lights a sofa without a ceiling fixture.",
      "terra-path-light": "Owners appreciate the wire-free setup and the automatic dusk-to-dawn sensor — many buy a second set."
    },
    "video": {
      "eyebrow": "VIDEO REVIEWS",
      "title": "What our customers say",
      "subtitle": "Genuine reviews, filmed by customers who chose Acme Store products.",
      "verifiedClient": "Verified customer",
      "playReviewByName": "Play {name}'s video review",
      "iframeTitle": "Video review – {name}"
    },
    "topics": {
      "stralucire": "Shine",
      "durabilitate": "Durability",
      "aspect": "Appearance",
      "pret": "Price",
      "instalare": "Installation",
      "ambalare": "Packaging",
      "livrare": "Delivery",
      "calitate": "Quality",
      "raport-calitate-pret": "Value for money",
      "siguranta": "Safety",
      "baterii": "Batteries",
      "blocare-anti-bruteforce": "Anti-brute-force lock",
      "business": "Professional",
      "capacitate": "Capacity",
      "cheie": "Key",
      "cheie-rezerva": "Backup key",
      "design": "Design",
      "dimensiuni": "Dimensions",
      "display": "Display",
      "fingerprint": "Fingerprint",
      "jet": "Jets",
      "jet-pahare": "Glass rinser",
      "led": "LED",
      "pin": "PIN",
      "securitate": "Security",
      "tocator-inox": "Stainless steel board",
      "utilitate": "Usefulness",
      "utilizare": "Ease of use",
      "amprenta": "Fingerprint",
      "wireless": "Wireless charging",
      "usb": "USB",
      "bluetooth": "Bluetooth",
      "senzor": "Sensor",
      "sertare": "Drawers"
    }
  },
  "footer": {
    "usefulLinks": "Useful links",
    "links": {
      "home": "Home",
      "despreNoi": "About us",
      "shop": "Shop",
      "blog": "Blog",
      "contact": "Contact"
    },
    "legal": "Legal",
    "legalLinks": {
      "termsConditions": "Terms and conditions",
      "privacy": "Privacy policy",
      "returns": "Returns policy",
      "howToOrder": "How to order",
      "returnForm": "Return form"
    },
    "newsletter": "Subscribe to our newsletter!",
    "odrTitle": "Online dispute resolution",
    "odrSub": "Find out more",
    "copyright": "Copyright © {year} <strong>Acme Store</strong> — All rights reserved.",
    "signature": "Designed with passion."
  },
  "popup": {
    "email": {
      "close": "Close",
      "badge": "🎁 EXCLUSIVE OFFER",
      "title": "-{percent}%",
      "subtitleAfter": "on your first order",
      "subtitle": "Enter your email address to automatically receive a <strong>{percent}%</strong> discount on your first order and check out faster.",
      "placeholder": "name@email.com",
      "submit": "Claim my {percent}% discount →",
      "hint": "No spam. Unsubscribe at any time.",
      "successTitle": "Thank you! 🎉",
      "successSubtitle": "The welcome discount will be applied automatically at checkout, and your email has been saved to speed things up.",
      "errorInvalidEmail": "Please enter a valid email address."
    },
    "exitIntent": {
      "close": "Close",
      "badge": "{percent}% discount",
      "title": "You weren't leaving without your basket, were you?",
      "copyPrimary": "🤝 First impressions matter! Enjoy <strong>{percent}%</strong> off as you explore our range!",
      "copySecondary": "🎁 Enter your email and unlock your discount. Guaranteed, free 14-day returns and fast phone support.",
      "placeholder": "Enter your email address here!",
      "submit": "Save",
      "successTitle": "Thank you! 🎉",
      "successCopy": "Your {percent}% discount will be applied automatically to your next order.",
      "errorInvalidEmail": "Please enter a valid email address."
    },
    "newsletter": {
      "firstNamePlaceholder": "First name",
      "firstNameAria": "First name",
      "lastNamePlaceholder": "Last name",
      "lastNameAria": "Last name",
      "emailPlaceholder": "Email",
      "emailAria": "Email",
      "submit": "Subscribe",
      "submitting": "...",
      "success": "✓ Thank you",
      "error": "Please enter a valid email address."
    }
  },
  "product": {
    "addToCart": "Add to basket",
    "inStock": "In stock",
    "preOrder": "Pre-order",
    "soon": "Coming soon",
    "page": {
      "breadcrumbAria": "Navigation",
      "headings": {
        "videoReviews": "Video reviews",
        "description": "Description",
        "customerReviews": "Customer reviews",
        "crossSell": "Customers also bought",
        "popular": "Popular products",
        "faq": "Frequently asked questions"
      },
      "categoryShort": {
        "furniture": "Furniture",
        "lighting": "Lighting",
        "outdoor": "Outdoor"
      }
    },
    "buybox": {
      "addToCart": "Add to basket",
      "added": "Added ✓",
      "discountBadge": "-{percent}%",
      "dimensionLabel": "Full dimensions",
      "deliveryNotice": "Order now, delivery {date}.",
      "deliveryHelper": "The date is an estimate and applies to in-stock items only. The {days}-day lead time is calculated in working days only.",
      "helpHello": "Hello, my name is ",
      "helpAfter": "! If you need any help, you can call me at any time on ",
      "helpOr": " or email me at ",
      "supportAria": "Customer support",
      "supportAlt": "{name} - customer support",
      "qtyDecrease": "Decrease",
      "qtyIncrease": "Increase",
      "paymentSecure": "100% secure payment,",
      "paymentVia": "via Revolut",
      "categoriesLabel": "Categories:",
      "shareLabel": "Share",
      "shareFacebook": "Share on Facebook",
      "shareWhatsapp": "Share on WhatsApp",
      "shareTelegram": "Share on Telegram",
      "shareEmail": "Share by email",
      "ratingAria": "Rating {rating} out of 5 stars",
      "ratingValue": "{rating} out of 5",
      "ratingCount": "({count, plural, one {# review} other {# reviews}})"
    },
    "upsell": {
      "badge": {
        "furniture": "See the premium model",
        "lighting": "See the larger model",
        "outdoor": "See the premium model"
      },
      "priceDiff": "+ {amount} compared to {name}"
    },
    "floatingBar": {
      "addToCart": "Add to basket",
      "added": "Added ✓"
    },
    "gallery": {
      "thumbAria": "Image {n}: {label}",
      "expandAria": "Enlarge image {n}",
      "dotAria": "Go to image {n}",
      "lightboxAria": "Product gallery — enlarged view",
      "lightboxClose": "Close gallery",
      "lightboxPrev": "Previous image",
      "lightboxNext": "Next image"
    }
  },
  "home": {
    "categories": {
      "furniture": {
        "label": "Solid wood",
        "name": "Furniture"
      },
      "lighting": {
        "label": "Warm light",
        "name": "Lighting"
      },
      "outdoor": {
        "label": "Garden",
        "name": "Outdoor"
      },
      "comingSoonBadge": "Coming soon",
      "saleBadge": "Spring Sale ✨"
    },
    "sections": {
      "furniture": {
        "eyebrow": "SOLID WOOD",
        "title": "Furniture for every room"
      },
      "lighting": {
        "eyebrow": "WARM LIGHT",
        "title": "Lighting that sets the mood"
      },
      "outdoor": {
        "eyebrow": "GARDEN",
        "title": "Outdoor & solar lighting"
      }
    },
    "stockBadge": {
      "inStock": "In stock",
      "preorder": "Pre-order"
    },
    "trade": {
      "tag": "Project enquiries",
      "title": "Hotels, showrooms, and projects with specific requirements",
      "description": "We put together offers for large quantities, product combinations, and projects where you need installation recommendations or fitting advice.",
      "cta": "Request a custom quote",
      "newPrefix": "NEW!",
      "whatsappMessage": "Hello! I have a project and I'd like a personalised Acme Store quote.",
      "emailSubject": "Custom quote request",
      "emailBody": "Hello,\n\nI have a project and I'd like to receive a personalised Acme Store quote.\n\nThank you."
    },
    "trust": [
      {
        "icon": "🛡️",
        "title": "Premium materials",
        "description": "Acme Store products are made from carefully selected materials — solid wood, quality glass and brass."
      },
      {
        "icon": "🚚",
        "title": "Fast delivery",
        "description": "Fast delivery across the United Kingdom. Pay by card (Apple Pay, Google Pay, Visa, Mastercard)."
      },
      {
        "icon": "🛠️",
        "title": "24-month guarantee",
        "description": "All Acme Store products come with a 24-month guarantee and installation support."
      },
      {
        "icon": "🔒",
        "title": "100% secure payment",
        "description": "Pay by card via Revolut: Apple Pay, Google Pay, Visa, Mastercard. Encrypted processing."
      }
    ],
    "spring": {
      "title": "SPRING SALE 2026",
      "subtitle": "Welcome spring with discounts that make a real difference"
    },
    "about": {
      "eyebrow": "ABOUT US",
      "title": "Why Acme Store?",
      "description": "We're a team passionate about design and quality, selecting only premium products for your home — with real support before and after your order.",
      "cta": "Learn more about us →",
      "values": {
        "support": {
          "title": "Dedicated support",
          "desc": "Email or phone — we're here to help."
        },
        "quality": {
          "title": "Verified quality",
          "desc": "Every product meets strict selection criteria."
        },
        "passion": {
          "title": "Genuine passion",
          "desc": "We only choose what truly deserves a place in your home."
        }
      }
    },
    "trademark": {
      "label": "Acme Store® — Registered trademark OSIM",
      "validUntil": "Valid until"
    },
    "returnPolicy": {
      "title": "14-day returns — no questions asked",
      "description": "Not satisfied? Return the product without any explanation or penalty. Simple.",
      "cta": "View returns policy"
    },
    "hero": {
      "saleEyebrow": "LIMITED OFFER",
      "saleTitle": "SPRING SALE 2026",
      "saleSub": "Welcome spring with discounts that make a real difference",
      "slides": [
        {
          "alt": "Styled bedroom with an oak nightstand",
          "label": "Spring Sale 2026",
          "sublabel": "Real discounts across the collection",
          "cta": "Shop now"
        },
        {
          "alt": "Opal glass table lamp on a sideboard",
          "label": "Lighting that sets the mood",
          "sublabel": "Dimmable lamps in glass & brass",
          "cta": "View lighting"
        },
        {
          "alt": "Solar path lights lining a garden path at dusk",
          "label": "Solar garden lighting",
          "sublabel": "Wire-free, dusk-to-dawn",
          "cta": "View outdoor"
        },
        {
          "alt": "White and oak console table in a hallway",
          "label": "Furniture in solid oak",
          "sublabel": "Minimal pieces, built to last",
          "cta": "View furniture"
        }
      ],
      "dotAria": "Go to slide {n}"
    }
  },
  "badges": {
    "ariaTitle": "Order guarantees",
    "retur14Zile": "14-day returns",
    "plataSecurizata": "Secure payment",
    "livrareRapida": "Fast delivery"
  },
  "account": {
    "login": {
      "eyebrow": "ACCOUNT",
      "pageTitle": "Your Acme Store account",
      "pageSubtitle": "Sign in with the email address you used at checkout. We send you a link — no password needed.",
      "title": "Sign in",
      "emailLabel": "Email address",
      "emailPlaceholder": "name@email.com",
      "submit": "Send me a sign-in link",
      "sending": "Sending…",
      "linkSent": "✓ Check your email. We've sent you a sign-in link.",
      "linkSentHint": "The link is valid for 15 minutes. If you can't see it, check your Spam folder.",
      "hint": "If the email address isn't recognised, you won't receive any message.",
      "errorInvalidLink": "The sign-in link is invalid or has expired. Please request a new one.",
      "errorRateLimited": "Too many attempts. Please try again in an hour.",
      "errorGeneric": "Unable to send the link. Please try again."
    },
    "dashboard": {
      "eyebrow": "ACCOUNT",
      "title": "Welcome",
      "subtitle": "Your orders and purchase history.",
      "hello": "Hello",
      "loggedIn": "Signed in",
      "logout": "Sign out",
      "loggingOut": "Signing out…",
      "ordersHeading": "Your orders",
      "emptyOrders": "No orders have been placed with this email address yet.",
      "totalLabel": "Total",
      "viewOrder": "View order",
      "leaveReview": "Leave a review",
      "reviewAfterDelivery": "You'll be able to leave a review once your order has been delivered.",
      "status": {
        "received": "Received",
        "pending_payment": "Payment pending",
        "paid": "Paid",
        "cancelled": "Cancelled",
        "failed": "Failed",
        "refunded": "Refunded"
      }
    }
  }
} as const;

export type Strings = typeof strings;
export type Namespace = keyof Strings;
