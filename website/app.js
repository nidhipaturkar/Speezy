function scrollToDemo() {
    document.getElementById("demo").scrollIntoView({
        behavior: "smooth"
    });
}


function findRoute() {

    const merchant =
        document.getElementById("merchant").value.trim() || "Foreign Merchant";

    const amount =
        Number(document.getElementById("amount").value) || 100;

    const problem =
        document.getElementById("problem").value;


    const status =
        document.getElementById("routing-status");

    const result =
        document.getElementById("result");

    const statusText =
        document.getElementById("status-text");

    const merchantNode =
        document.getElementById("merchant-node");

    const routeName =
        document.getElementById("route-name");

    const resultTitle =
        document.getElementById("result-title");

    const paymentAmount =
        document.getElementById("payment-amount");


    result.classList.add("hidden");

    status.classList.remove("hidden");


    const stages = [
        "Understanding merchant requirements",
        "Checking available payment capabilities",
        "Creating viable payment routes",
        "Scoring route reliability and cost",
        "Selecting the best available route"
    ];


    let stage = 0;


    const interval = setInterval(() => {

        statusText.textContent = stages[stage];

        stage++;


        if (stage >= stages.length) {

            clearInterval(interval);

            setTimeout(() => {

                status.classList.add("hidden");

                result.classList.remove("hidden");

                merchantNode.textContent = merchant;

                resultTitle.textContent =
                    `Speezy found a route to ${merchant}.`;

                routeName.textContent =
                    "UPI → Speezy → Payment Partner → Merchant";

                const inrAmount =
                    Math.round(amount * 87);

                paymentAmount.textContent =
                    `₹${inrAmount.toLocaleString("en-IN")}`;

                result.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

            }, 600);
        }

    }, 650);
}
