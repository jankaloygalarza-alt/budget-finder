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

  function scrollMessages(root) {
    var box = root.querySelector("[data-budget-messages]");
    if (box) box.scrollTop = box.scrollHeight;
  }

  function appendUserMessage(root, text) {
    var box = root.querySelector("[data-budget-messages]");
    if (!box) return;
    var msg = document.createElement("div");
    msg.className = "budget-finder__msg budget-finder__msg--user";
    var bubble = document.createElement("div");
    bubble.className = "budget-finder__bubble";
    bubble.textContent = text;
    msg.appendChild(bubble);
    box.appendChild(msg);
    scrollMessages(root);
  }

  function appendBotMessage(root, options) {
    var box = root.querySelector("[data-budget-messages]");
    if (!box) return null;
    var msg = document.createElement("div");
    msg.className = "budget-finder__msg budget-finder__msg--bot";

    if (options.text) {
      var p = document.createElement("p");
      p.className =
        "budget-finder__msg-text" +
        (options.error ? " budget-finder__msg-error" : "");
      p.textContent = options.text;
      msg.appendChild(p);
    }

    if (options.heading) {
      var h = document.createElement("h3");
      h.className = "budget-finder__msg-heading";
      h.textContent = options.heading;
      msg.appendChild(h);
    }

    if (options.productsEl) msg.appendChild(options.productsEl);

    if (options.followUp) {
      var follow = document.createElement("p");
      follow.className = "budget-finder__msg-text";
      follow.textContent = options.followUp;
      msg.appendChild(follow);
    }

    box.appendChild(msg);
    scrollMessages(root);
    return msg;
  }

  function buildProductRow(products, labels) {
    var row = document.createElement("div");
    row.className = "budget-finder__products";

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

      var title = document.createElement("h4");
      title.className = "budget-finder__title";
      var titleLink = document.createElement("a");
      titleLink.href = product.url;
      titleLink.textContent = product.title;
      title.appendChild(titleLink);

      var meta = document.createElement("p");
      meta.className = "budget-finder__meta";
      meta.textContent =
        product.productType || product.reason || "Under your budget";

      var price = document.createElement("p");
      price.className = "budget-finder__price";
      price.textContent = formatMoney(product.price, product.currency);

      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "budget-finder__add";
      addBtn.textContent = labels.addLabel;
      addBtn.disabled = !product.available || !product.variantId;
      addBtn.addEventListener("click", function () {
        addToCart(addBtn, product.variantId, labels);
      });

      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(price);
      body.appendChild(addBtn);
      card.appendChild(media);
      card.appendChild(body);
      row.appendChild(card);
    });

    return row;
  }

  function refreshCartUi() {
    document.dispatchEvent(new CustomEvent("cart:refresh"));
    document.dispatchEvent(new CustomEvent("cart:updated"));
  }

  function addToCart(button, variantId, labels) {
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
      body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
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

  function setupBudgetSlider(root, currency) {
    var slider = root.querySelector("[data-budget-slider]");
    var valueEl = root.querySelector("[data-budget-value]");
    if (!slider || !valueEl) return;

    function syncValue() {
      valueEl.textContent = formatMoney(slider.value, currency);
    }
    slider.addEventListener("input", syncValue);
    syncValue();
  }

  function runSearch(root, proxyUrl, labels, category, displayText) {
    var slider = root.querySelector("[data-budget-slider]");
    var max = Number(slider && slider.value);
    var submit = root.querySelector("[data-budget-submit]");
    var queryInput = root.querySelector("[data-budget-query]");

    if (Number.isNaN(max) || max <= 0) {
      appendBotMessage(root, {
        text: "Choose a valid budget first.",
        error: true,
      });
      return;
    }

    appendUserMessage(root, displayText);
    if (queryInput) queryInput.value = "";
    if (submit) submit.disabled = true;

    appendBotMessage(root, { text: "Finding products under your budget…" });

    var url =
      proxyUrl + "?min=0&max=" + encodeURIComponent(String(max));
    if (category) url += "&category=" + encodeURIComponent(category);

    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error("Budget Finder API returned an invalid response.");
            }
          }
          if (!response.ok) {
            throw new Error(
              (data && data.error) ||
                "Could not load recommendations (HTTP " + response.status + ")",
            );
          }
          if (!data) throw new Error("Budget Finder API returned an empty response.");
          return data;
        });
      })
      .then(function (data) {
        var products = data.products || [];
        var box = root.querySelector("[data-budget-messages]");
        if (box && box.lastElementChild) box.removeChild(box.lastElementChild);

        if (!products.length) {
          appendBotMessage(root, { text: labels.emptyText });
          return;
        }

        var heading =
          category ||
          (products[0] && products[0].productType) ||
          "Picks for you";
        var followUp =
          products.length > 1
            ? "Which one fits your budget best? Tap Add to cart on a card."
            : "Looks like a strong match — want to add it?";

        appendBotMessage(root, {
          text:
            "Here are options within " +
            formatMoney(max, labels.currency) +
            ".",
          heading: heading,
          productsEl: buildProductRow(products, labels),
          followUp: followUp,
        });
      })
      .catch(function (error) {
        var box = root.querySelector("[data-budget-messages]");
        if (box && box.lastElementChild) box.removeChild(box.lastElementChild);
        appendBotMessage(root, {
          text: error.message || "Something went wrong",
          error: true,
        });
      })
      .finally(function () {
        if (submit) submit.disabled = false;
      });
  }

  function init(root) {
    if (root.dataset.budgetFinderReady === "true") return;
    root.dataset.budgetFinderReady = "true";

    var proxyUrl = root.dataset.proxyUrl;
    var currency = root.dataset.currency || "USD";
    var labels = {
      emptyText:
        root.dataset.emptyText || "No products found in that budget range.",
      addLabel: root.dataset.addLabel || "Add to cart",
      addedLabel: root.dataset.addedLabel || "Added",
      currency: currency,
    };

    setupBudgetSlider(root, currency);

    var form = root.querySelector("[data-budget-form]");
    var categoryHidden = root.querySelector("[data-budget-category-value]");
    var queryInput = root.querySelector("[data-budget-query]");

    root.querySelectorAll("[data-budget-suggest]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.getAttribute("data-budget-suggest") || "";
        if (categoryHidden) categoryHidden.value = cat;
        if (queryInput) queryInput.value = cat;
        runSearch(root, proxyUrl, labels, cat, cat);
      });
    });

    if (!form) return;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var query = queryInput ? String(queryInput.value || "").trim() : "";
      if (categoryHidden) categoryHidden.value = query;
      if (!query) {
        appendBotMessage(root, {
          text: "Type what you’re looking for, or tap a suggestion.",
          error: true,
        });
        return;
      }
      runSearch(root, proxyUrl, labels, query, query);
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
