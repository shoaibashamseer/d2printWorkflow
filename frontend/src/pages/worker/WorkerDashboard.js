import { useEffect, useState } from "react";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import WorkOrderCard from "./WorkOrderCard";

import "../../styles/worker.css";


export default function WorkerDashboard() {

    const [orders, setOrders] = useState([]);

    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState("today");

    const [expandedOrder, setExpandedOrder] = useState(null);

    const [search, setSearch] = useState("");

    const navigate = useNavigate();

    const handleLogout = () => {

            localStorage.clear();
            navigate("/login", { replace: true });

        };



    const loadOrders = async () => {

        try{

            const res = await api.get("worker/workorders/");

            setOrders(res.data);

        }

        catch(err){

            console.log(err);

        }

        finally{

            setLoading(false);

        }

    };



    useEffect(()=>{

        loadOrders();

        const interval = setInterval(loadOrders,30000);

        return ()=>clearInterval(interval);

    },[]);



    const toggleOrder=(id)=>{

        if(expandedOrder===id){

            setExpandedOrder(null);

        }

        else{

            setExpandedOrder(id);

        }

    };



    const filteredOrders=orders.filter(order=>{

        const keyword=search.toLowerCase();

        return(

            order.customer.toLowerCase().includes(keyword)

            ||

            (order.company||"").toLowerCase().includes(keyword)

            ||

            order.products.some(

                p=>p.product.toLowerCase().includes(keyword)

            )

        );

    });



    const todayOrders=filteredOrders.filter(

        o=>!o.completed

    );
    
    const deliveryOrders = filteredOrders.filter(
       
       
        o => o.completed && !o.delivered
    
    );



    const billingOrders=filteredOrders.filter(

        o=>o.completed

    );



    const overdueOrders=filteredOrders.filter(

        o=>o.priority==="overdue"

    );



    return(

        <div className="worker-page">

            <div className="worker-header">

                <div>

                    <h2>

                        Production Dashboard

                    </h2>

                    <span>

                        Double2Print ERP

                    </span>

                </div>



                <div className="header-actions">

                    <button
                        type="button"
                        className="place-order-btn"
                        onClick={() => navigate("/orders/new")}
                    >
                        ➕ Place Order
                    </button>

                    <button
                        type="button"
                        className="refresh-btn"
                        onClick={loadOrders}
                    >
                        🔄 Refresh
                    </button>
                    <button
                        type="button"
                        className="logout-btn"
                        onClick={handleLogout}
                    >
                        🚪 Logout
                    </button>

                </div>

        </div>



            <input

                className="worker-search"

                placeholder="Search customer, company or product..."

                value={search}

                onChange={(e)=>setSearch(e.target.value)}

            />



            <div className="worker-tabs">

                <button

                    className={activeTab==="today"?"active":""}

                    onClick={()=>setActiveTab("today")}

                >

                    Today's Work

                </button>
                <button
                    className={activeTab==="delivery" ? "active" : ""}
                    onClick={()=>setActiveTab("delivery")}
                >
                    Delivery
                </button>

                <button

                    className={activeTab==="billing"?"active":""}

                    onClick={()=>setActiveTab("billing")}

                >

                    Billing

                </button>



                <button

                    className={activeTab==="finished"?"active":""}

                    onClick={()=>setActiveTab("finished")}

                >

                    Finished

                </button>



                <button

                    className={activeTab==="overdue"?"active":""}

                    onClick={()=>setActiveTab("overdue")}

                >

                    Overdue

                </button>

            </div>



            {loading && (

                <div className="loading">

                    Loading...

                </div>

            )}


            <div className="worker-orders">
                
                {!loading && activeTab==="today" &&

                    todayOrders.map(order=>(

                        <WorkOrderCard

                            key={order.order_id}

                            order={order}

                            expanded={expandedOrder===order.order_id}

                            onToggle={()=>toggleOrder(order.order_id)}

                        />

                    ))

                }

            </div>

            <div className="worker-orders">
               
                {!loading && activeTab==="delivery" &&
                    
                    deliveryOrders.map(order=>(
                        
                        <WorkOrderCard
                            key={order.order_id}
                            order={order}
                            expanded={expandedOrder===order.order_id}
                            onToggle={()=>toggleOrder(order.order_id)}
                        />
                        
                    ))

                }

            </div>

            <div className="worker-orders">
                {!loading && activeTab==="billing" &&

                    billingOrders.map(order=>(

                        <WorkOrderCard

                            key={order.order_id}

                            order={order}

                            expanded={expandedOrder===order.order_id}

                            onToggle={()=>toggleOrder(order.order_id)}

                        />

                    ))

                }
            </div>

            <div className="worker-orders">

                {!loading && activeTab==="overdue" &&

                    overdueOrders.map(order=>(

                        <WorkOrderCard

                            key={order.order_id}

                            order={order}

                            expanded={expandedOrder===order.order_id}

                            onToggle={()=>toggleOrder(order.order_id)}

                        />

                    ))

                }
            </div>

        </div>

    );

}