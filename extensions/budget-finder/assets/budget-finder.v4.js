(function () {
  function formatMoney(amount, currency) {
    var value = Number(amount);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(value);
    } catch (e) {
      return (currency || "USD") + " " + value.toFixed(2);
    }
  }

  function setStatus(root, message, tone) {
    var status = root.querySelector("[data-budget-status]");
    if (!status) return;
    if (!message) {
      status.hidden = true;
      status.textContent = "";
      status.removeAttribute("data-tone");
      return;
    }
    status.hidden = false;
    status.textContent = message;
    if (tone) status.setAttribute("data-tone", tone);
    else status.removeAttribute("data-tone");
  }

  function renderProducts(root, products, labels) {
    var results = root.querySelector("[data-budget-results]");
    results.innerHTML = "";

    if (!products.length) {
      setStatus(root, labels.emptyText, null);
      return;
    }

    setStatus(root, products.length + " product(s) found", null);

    products.forEach(function (product) {
      var card = document.createElement("article");
      card.className = "budget-finder__card";

      var media = document.createElement("a");
      media.className = "budget-finder__media";
      media.href = product.url;
      if (product.imageUrl) {
        var img = document.createElement("img");
        img.src = product.imageUrl;
        img.alt = product.title;
        img.loading = "lazy";
        media.appendChild(img);
      }

      var body = document.createElement("div");
      body.className = "budget-finder__body";

      var title = document.createElement("h3");
      title.className = "budget-finder__title";
      var titleLink = document.createElement("a");
      titleLink.href = product.url;
      titleLink.textContent = product.title;
      title.appendChild(titleLink);

      var price = document.createElement("p");
      price.className = "budget-finder__price";
      price.textContent = formatMoney(product.price, product.currency);

      var reason = document.createElement("p");
      reason.className = "budget-finder__reason";
      reason.textContent = product.reason || "Solid pick under your budget";

      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "budget-finder__add";
      addBtn.textContent = labels.addLabel;
      addBtn.disabled = !product.available || !product.variantId;
      addBtn.addEventListener("click", function () {
        addToCart(root, addBtn, product.variantId, labels);
      });

      body.appendChild(title);
      body.appendChild(price);
      body.appendChild(reason);
      body.appendChild(addBtn);
      card.appendChild(media);
      card.appendChild(body);
      results.appendChild(card);
    });
  }

  function refreshCartUi() {
    document.dispatchEvent(new CustomEvent("cart:refresh"));
    document.dispatchEvent(new CustomEvent("cart:updated"));
    if (window.Shopify && typeof window.Shopify.onCartUpdate === "function") {
      try {
        window.Shopify.onCartUpdate();
      } catch (e) {}
    }
  }

  function updateCartCount(root) {
    var countEl = root.querySelector("[data-budget-cart-count]");
    if (!countEl) return;
    var cartRoot =
      (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ||
      "/";
    fetch(cartRoot + "cart.js", { headers: { Accept: "application/json" } })
      .then(function (response) {
        return response.json();
      })
      .then(function (cart) {
        countEl.textContent = String(cart.item_count || 0);
      })
      .catch(function () {});
  }

  function addToCart(root, button, variantId, labels) {
    if (!variantId) return;
    var original = labels.addLabel;
    button.disabled = true;
    button.textContent = "Adding…";

    var cartRoot =
      (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ||
      "/";
    fetch(cartRoot + "cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        items: [{ id: variantId, quantity: 1 }],
      }),
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error("Could not add to cart");
            }
          }
          if (!response.ok) {
            throw new Error(
              (data && (data.description || data.message)) ||
                "Could not add to cart",
            );
          }
          return data;
        });
      })
      .then(function () {
        button.textContent = labels.addedLabel;
        button.classList.add("is-success");
        refreshCartUi();
        updateCartCount(root);
        setTimeout(function () {
          button.textContent = original;
          button.classList.remove("is-success");
          button.disabled = false;
        }, 1600);
      })
      .catch(function (error) {
        button.textContent = original;
        button.disabled = false;
        alert(error.message || "Could not add to cart");
      });
  }

  function setupCategoryChips(root) {
    var chips = root.querySelectorAll("[data-budget-category]");
    var hidden = root.querySelector("[data-budget-category-value]");
    if (!hidden) return;

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (other) {
          other.classList.remove("is-active");
          other.setAttribute("aria-pressed", "false");
        });
        chip.classList.add("is-active");
        chip.setAttribute("aria-pressed", "true");
        hidden.value = chip.getAttribute("data-budget-category") || "";
      });
    });
  }

  function setupBudgetSlider(root) {
    var slider = root.querySelector("[data-budget-slider]");
    var valueEl = root.querySelector("[data-budget-value]");
    if (!slider || !valueEl) return;

    var currency = root.dataset.currency || "USD";

    function syncValue() {
      valueEl.textContent = formatMoney(slider.value, currency);
    }

    slider.addEventListener("input", syncValue);
    syncValue();
  }

  function setupFloatingPanel(root) {
    var openBtn = root.querySelector("[data-budget-open]");
    var panel = root.querySelector("[data-budget-panel]");
    var closers = root.querySelectorAll("[data-budget-close]");
    if (!openBtn || !panel) return;

    function openPanel() {
      panel.hidden = false;
      closers.forEach(function (el) {
        if (el.classList.contains("budget-finder__backdrop")) el.hidden = false;
      });
      openBtn.setAttribute("aria-expanded", "true");
      document.body.classList.add("budget-finder-open");
      updateCartCount(root);
      var scroller = root.querySelector("[data-budget-scroll]");
      if (scroller) scroller.scrollTop = 0;
    }

    function closePanel() {
      panel.hidden = true;
      closers.forEach(function (el) {
        if (el.classList.contains("budget-finder__backdrop")) el.hidden = true;
      });
      openBtn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("budget-finder-open");
    }

    openBtn.addEventListener("click", function () {
      if (panel.hidden) openPanel();
      else closePanel();
    });

    closers.forEach(function (el) {
      el.addEventListener("click", closePanel);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) closePanel();
    });
  }

  function init(root) {
    if (root.dataset.budgetFinderReady === "true") return;
    root.dataset.budgetFinderReady = "true";

    var form = root.querySelector("[data-budget-form]");
    var submit = root.querySelector("[data-budget-submit]");
    var proxyUrl = root.dataset.proxyUrl;
    var labels = {
      emptyText: root.dataset.emptyText || "No products found in that budget range.",
      addLabel: root.dataset.addLabel || "Add to cart",
      addedLabel: root.dataset.addedLabel || "Added",
    };

    setupFloatingPanel(root);
    setupCategoryChips(root);
    setupBudgetSlider(root);
    updateCartCount(root);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var slider = root.querySelector("[data-budget-slider]");
      var max = Number(slider && slider.value);
      var min = 0;
      var categoryInput = root.querySelector("[data-budget-category-value]");
      var category = categoryInput ? String(categoryInput.value || "").trim() : "";

      if (Number.isNaN(max) || max <= 0) {
        setStatus(root, "Choose a valid budget.", "error");
        return;
      }

      submit.disabled = true;
      setStatus(root, "Finding products…", null);
      root.querySelector("[data-budget-results]").innerHTML = "";

      var url =
        proxyUrl +
        "?min=" +
        encodeURIComponent(String(min)) +
        "&max=" +
        encodeURIComponent(String(max));
      if (category) {
        url += "&category=" + encodeURIComponent(category);
      }

      fetch(url, {
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          return response.text().then(function (text) {
            var data = null;
            if (text) {
              try {
                data = JSON.parse(text);
              } catch (e) {
                throw new Error(
                  "Budget Finder API returned an invalid response. Make sure the app is running and the app proxy is configured.",
                );
              }
            }
            if (!response.ok) {
              throw new Error(
                (data && data.error) ||
                  "Could not load recommendations (HTTP " +
                    response.status +
                    ")",
              );
            }
            if (!data) {
              throw new Error(
                "Budget Finder API returned an empty response. Restart shopify app dev and reinstall if needed.",
              );
            }
            return data;
          });
        })
        .then(function (data) {
          renderProducts(root, data.products || [], labels);
        })
        .catch(function (error) {
          setStatus(root, error.message || "Something went wrong", "error");
        })
        .finally(function () {
          submit.disabled = false;
        });
    });
  }

  function boot() {
    document.querySelectorAll("[data-budget-finder]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
