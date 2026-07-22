import React from "react";
import api from "../../api/api";

export default function WorkOrderDetails({ order }) {

    const completeTask = async () => {

        if (!order.my_task) return;

        try {

            await api.post(
                `tasks/${order.my_task.task_id}/complete/`
            );

            window.location.reload();

        } catch (err) {

            alert(
                err.response?.data?.error ||
                "Unable to complete task."
            );

        }

    };

    const getStatusIcon = (status) => {

        switch (status) {

            case "completed":
                return "✅";

            case "in_progress":
                return "🟦";

            case "ready":
                return "🟡";

            default:
                return "⚪";
        }

    };

    return (

        <div className="workorder-details">

            {/* CUSTOMER */}

            <div className="detail-section">

                <h4>Customer Details</h4>

                <div>

                    <strong>Name :</strong>

                    {order.customer}

                </div>

                {order.company && (

                    <div>

                        <strong>Company :</strong>

                        {order.company}

                    </div>

                )}

                <div>

                    <strong>Phone :</strong>

                    {order.phone}

                </div>

                <div>

                    <strong>Delivery :</strong>

                    {order.delivery_date}

                </div>

            </div>

            {/* PRODUCTS */}

            <div className="detail-section">

                <h4>Products</h4>

                {order.products.map(product => (

                    <div
                        className="detail-product"
                        key={product.id}
                    >

                        <div className="product-header">

                            <strong>

                                {product.quantity} × {product.product}

                            </strong>

                            <span>

                                ₹ {product.total}

                            </span>

                        </div>

                        {product.features.length > 0 && (

                            <div className="feature-list">

                                {product.features.map((f, i) => (

                                    <div key={i}>

                                        • {f.name} : {f.value}

                                    </div>

                                ))}

                            </div>

                        )}

                    </div>

                ))}

            </div>

            {/* WORKFLOW */}

            <div className="detail-section">

                <h4>Production Timeline</h4>

                <div className="timeline">

                    {order.workflow.map((step,index)=>(

                        <React.Fragment key={step.task_id}>

                            <div className="timeline-item">

                                <div
                                    className={`timeline-circle ${step.status}`}
                                >

                                    {getStatusIcon(step.status)}

                                </div>

                                <div className="timeline-title">

                                    {step.step}

                                </div>

                                <div className="timeline-worker">

                                    {step.worker || "-"}

                                </div>

                            </div>

                            {index !== order.workflow.length-1 && (

                                <div className="timeline-line"/>

                            )}

                        </React.Fragment>

                    ))}

                </div>

            </div>

            {/* CURRENT WORK */}

            {order.my_task && (

                <div className="detail-section current-work">

                    <h4>

                        Current Work

                    </h4>

                    <div>

                        <strong>

                            {order.my_task.step}

                        </strong>

                    </div>

                    <div>

                        Status :

                        {order.my_task.status}

                    </div>

                    {order.my_task.can_start && (

                        <button
                            className="worker-btn start-btn"
                            onClick={async () => {

                                await api.post(
                                    `tasks/${order.my_task.task_id}/start/`
                                );

                                window.location.reload();

                            }}
                        >

                            Start Work

                        </button>

                    )}

                    {order.my_task.can_complete && (

                        <button
                            className="worker-btn complete-btn"
                            onClick={completeTask}
                        >

                            Complete Work

                        </button>

                    )}

                </div>

            )}

            {/* GRAND TOTAL */}

            <div className="grand-total">

                Grand Total

                <span>

                    ₹ {order.grand_total}

                </span>

            </div>

        </div>

    );

}