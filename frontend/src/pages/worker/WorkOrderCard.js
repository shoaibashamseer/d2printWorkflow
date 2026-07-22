import React from "react";
import WorkOrderDetails from "./WorkOrderDetails";

export default function WorkOrderCard({
    order,
    expanded,
    onToggle,
}) {

    const getBorderColor = () => {

        if (order.priority === "overdue")
            return "#dc2626";

        if (order.priority === "today")
            return "#f59e0b";

        return "#22c55e";
    };

    return (

        <div
            className="workorder-card"
            style={{
                borderLeft: `6px solid ${getBorderColor()}`
            }}
            onClick={onToggle}
        >

            {/* HEADER */}

            <div className="workorder-header">

                <div>

                    <h3>

                        {order.customer}

                    </h3>

                    {order.company && (

                        <div className="company">

                            🏢 {order.company}

                        </div>

                    )}

                </div>

                <div className="delivery">

                    📅 {order.delivery_date}

                </div>

            </div>

            {/* PRODUCTS */}

            <div className="product-list">

                {order.products
                    .slice(0, 3)
                    .map((p) => (

                        <div
                            key={p.id}
                            className="product-row"
                        >

                            {p.quantity} × {p.product}

                        </div>

                    ))}

                {order.products.length > 3 && (

                    <div className="more-products">

                        +{order.products.length - 3} more...

                    </div>

                )}

            </div>

            {/* PROGRESS */}

            <div className="progress-section">

                <div className="progress-label">

                    Progress

                    <strong>

                        {order.progress}%

                    </strong>

                </div>

                <div className="progress-bar">

                    <div
                        className="progress-fill"
                        style={{
                            width: `${order.progress}%`
                        }}
                    />

                </div>

            </div>

            {/* FOOTER */}

            <div className="workorder-footer">

                <div>

                    ₹ {order.grand_total}

                </div>

                <div className="expand-text">

                    {expanded
                        ? "▲ Hide Details"
                        : "▼ View Details"}

                </div>

            </div>

            {/* DETAILS */}

            {expanded && (

                <div
                    className="details-wrapper"
                    onClick={(e) => e.stopPropagation()}
                >

                    <WorkOrderDetails
                        order={order}
                    />

                </div>

            )}

        </div>

    );

}