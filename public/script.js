// public/script.js

let isDark = false;
let stagedFile = null;

// ---------- User Profile Display ----------
const resolvedUser = (typeof userName !== "undefined" && userName) ? userName : "Guest";
const firstLetter = resolvedUser.trim().charAt(0) || "U";

const userLogo = document.querySelector(".userLogo");
if (userLogo) {
  userLogo.innerText = firstLetter.toUpperCase();
}

document.querySelectorAll(".child3").forEach((span) => {
  span.innerText = resolvedUser;
});

// ---------- Staged File Attachment Elements ----------
const fileInput = document.getElementById("file-upload");
const filePreviewBar = document.getElementById("file-preview-bar");
const filePreviewName = document.getElementById("file-preview-name");
const fileRemoveBtn = document.getElementById("file-remove-btn");
const searchInput = document.getElementById("search-query");

if (fileInput) {
  fileInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    stagedFile = file;

    if (filePreviewName) {
      filePreviewName.textContent = file.name;
    }
    if (filePreviewBar) {
      filePreviewBar.style.display = "flex";
    }

    const greeting = document.querySelector(".mainBody4");
    if (greeting) {
      greeting.style.display = "none";
    }
    const mainGreeting = document.querySelector(".mainBody");
    if (mainGreeting) {
      mainGreeting.style.display = "none";
    }

    if (searchInput) {
      searchInput.focus();
    }
  });
}

if (fileRemoveBtn) {
  fileRemoveBtn.addEventListener("click", () => {
    stagedFile = null;
    if (fileInput) fileInput.value = "";
    if (filePreviewBar) filePreviewBar.style.display = "none";
  });
}

// ---------- Input & Enter Key Listener ----------
if (searchInput) {
  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

// ---------- Helper: Escape HTML ----------
function escapeHtml(text) {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}

// ---------- Add Message to Chat UI ----------
function addMessage(sender, message, fileName = null) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;

  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender === "You" ? "user" : "bot");

  let html = "";
  if (fileName) {
    html += `<div class="message-attachment">📎 ${escapeHtml(fileName)}</div>`;
  }
  if (message) {
    html += (typeof marked !== "undefined" && marked.parse) ? marked.parse(message) : escapeHtml(message);
  }
  msgDiv.innerHTML = html;

  chatBox.appendChild(msgDiv);

  requestAnimationFrame(() => {
    chatBox.scrollTo({
      top: chatBox.scrollHeight,
      behavior: "smooth",
    });
  });

  if (typeof hljs !== "undefined") {
    msgDiv.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  }
}

// ---------- Send Message / Document Query ----------
async function sendMessage() {
  const input = document.getElementById("search-query");
  const chatBox = document.getElementById("chat-box");
  if (!input || !chatBox) return;

  const message = input.value.trim();
  const file = stagedFile;

  if (!message && !file) return;

  // Hide initial greeting
  const greeting = document.querySelector(".mainBody4");
  if (greeting) {
    greeting.style.display = "none";
  }
  const mainGreeting = document.querySelector(".mainBody");
  if (mainGreeting) {
    mainGreeting.style.display = "none";
  }

  // Display user message in chat
  addMessage("You", message, file ? file.name : null);

  // Clear input & staged file state
  input.value = "";
  stagedFile = null;
  if (fileInput) fileInput.value = "";
  if (filePreviewBar) filePreviewBar.style.display = "none";

  // Create Bot Typing Placeholder
  const botTyping = document.createElement("div");
  botTyping.classList.add("message", "bot");
  botTyping.innerText = "QueryX is thinking...";
  chatBox.appendChild(botTyping);

  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: "smooth",
  });

  try {
    let response;

    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("message", message);

      response = await fetch("/submit-doc-query", {
        method: "POST",
        body: formData,
      });
    } else {
      response = await fetch("/submit-search-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    }

    const data = await response.json();
    const replyText = data.reply || data.summary || "No response received.";

    botTyping.innerHTML = (typeof marked !== "undefined" && marked.parse)
      ? marked.parse(replyText)
      : escapeHtml(replyText);

    if (typeof hljs !== "undefined") {
      botTyping.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
      });
    }

    chatBox.scrollTo({
      top: chatBox.scrollHeight,
      behavior: "smooth",
    });
  } catch (err) {
    botTyping.innerText = "Error: Unable to generate response.";
    console.error("Chat request error:", err);
  }
}

// ---------- QueryX Pro Payment Flow ----------
const upgradeProBtn = document.getElementById("upgradeProBtn");
const proModal = document.getElementById("proModal");
const closeProModal = document.getElementById("closeProModal");
const buyProBtn = document.getElementById("buyProBtn");
const proStatus = document.getElementById("proStatus");
const proPaymentMessage = document.getElementById("proPaymentMessage");

if (upgradeProBtn && proModal) {
  upgradeProBtn.addEventListener("click", () => {
    proModal.style.display = "flex";
  });
}

if (closeProModal && proModal) {
  closeProModal.addEventListener("click", () => {
    proModal.style.display = "none";
  });
}

if (proModal) {
  proModal.addEventListener("click", (event) => {
    if (event.target === proModal) {
      proModal.style.display = "none";
    }
  });
}

async function checkProStatus() {
  try {
    const response = await fetch("/api/pro/status");
    if (!response.ok) return;

    const data = await response.json();
    if (data.isPro) {
      if (proStatus) {
        const expiry = new Date(data.expiresAt).toLocaleDateString("en-IN");
        proStatus.textContent = `✦ QueryX Pro · Expires ${expiry}`;
      }
      if (upgradeProBtn) {
        upgradeProBtn.textContent = "Manage QueryX Pro";
      }
      if (buyProBtn) {
        buyProBtn.textContent = "Extend Pro – ₹99";
      }
    }
  } catch (error) {
    console.error("Subscription status error:", error);
  }
}

checkProStatus();

if (buyProBtn) {
  buyProBtn.addEventListener("click", async () => {
    try {
      buyProBtn.disabled = true;
      buyProBtn.textContent = "Creating secure order...";

      if (proPaymentMessage) {
        proPaymentMessage.textContent = "";
      }

      const orderResponse = await fetch("/api/pro/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const order = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(order.error || "Could not create payment order.");
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "QueryX",
        description: "QueryX Pro - 30 Days",
        order_id: order.orderId,
        handler: async function (paymentResponse) {
          try {
            buyProBtn.textContent = "Verifying payment...";

            const verifyResponse = await fetch("/api/pro/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paymentResponse),
            });

            const result = await verifyResponse.json();

            if (!verifyResponse.ok || !result.success) {
              throw new Error(result.error || "Payment verification failed.");
            }

            if (proPaymentMessage) {
              proPaymentMessage.textContent =
                "Payment successful! QueryX Pro is now active.";
            }

            await checkProStatus();
            buyProBtn.textContent = "Pro Activated";

            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } catch (error) {
            console.error(error);
            if (proPaymentMessage) {
              proPaymentMessage.textContent =
                error.message || "Could not verify payment.";
            }
            buyProBtn.disabled = false;
            buyProBtn.textContent = "Try Again";
          }
        },
        modal: {
          ondismiss: function () {
            buyProBtn.disabled = false;
            buyProBtn.textContent = "Buy QueryX Pro – ₹99";
          },
        },
        theme: {
          color: "#7c3aed",
        },
      };

      const checkout = new Razorpay(options);

      checkout.on("payment.failed", function (response) {
        console.error("Payment failed:", response.error);
        if (proPaymentMessage) {
          proPaymentMessage.textContent =
            response.error.description || "Payment failed. Please try again.";
        }
        buyProBtn.disabled = false;
        buyProBtn.textContent = "Try Again";
      });

      checkout.open();
    } catch (error) {
      console.error("Payment initiation error:", error);
      if (proPaymentMessage) {
        proPaymentMessage.textContent = error.message;
      }
      buyProBtn.disabled = false;
      buyProBtn.textContent = "Buy QueryX Pro – ₹99";
    }
  });
}

// ---------- Theme Toggle ----------
function applyTheme(isLight) {
  const toggleBtn = document.querySelector(".theme-toggle");
  if (isLight) {
    document.body.classList.add("light-mode");
    if (toggleBtn) toggleBtn.textContent = "🌙";
    localStorage.setItem("queryx_theme", "light");
    isDark = false;
  } else {
    document.body.classList.remove("light-mode");
    if (toggleBtn) toggleBtn.textContent = "☀️";
    localStorage.setItem("queryx_theme", "dark");
    isDark = true;
  }
}

function change_theme() {
  const isCurrentlyLight = document.body.classList.contains("light-mode");
  applyTheme(!isCurrentlyLight);
}

// Restore saved theme on page load
if (localStorage.getItem("queryx_theme") === "light") {
  applyTheme(true);
} else {
  applyTheme(false);
}

// ---------- Sidebar Toggle Logic ----------
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const sidebarOpenBtn = document.getElementById("sidebarOpenBtn");
const oneContainer = document.querySelector(".one");

function toggleSidebar(forceState) {
  if (!oneContainer) return;
  const shouldCollapse =
    forceState !== undefined
      ? forceState
      : !oneContainer.classList.contains("sidebar-collapsed");

  if (shouldCollapse) {
    oneContainer.classList.add("sidebar-collapsed");
  } else {
    oneContainer.classList.remove("sidebar-collapsed");
  }
  localStorage.setItem("sidebarCollapsed", shouldCollapse ? "true" : "false");
}

if (sidebarToggleBtn) {
  sidebarToggleBtn.addEventListener("click", () => toggleSidebar(true));
}

if (sidebarOpenBtn) {
  sidebarOpenBtn.addEventListener("click", () => toggleSidebar(false));
}

if (localStorage.getItem("sidebarCollapsed") === "true") {
  toggleSidebar(true);
}
