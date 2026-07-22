import { useState } from "react";
import api from "../api/api";
import "../styles/login.css";

function Login() {

    const [username,setUsername]=useState("");
    const [password,setPassword]=useState("");
    const [error,setError]=useState("");

    const handleSubmit = async (e)=>{

        e.preventDefault();

        setError("");

        try{

            const res = await api.post("auth/login/",{
                username,
                password,
            });

            localStorage.setItem("token",res.data.token);
            localStorage.setItem("user_id",res.data.user_id);
            localStorage.setItem("role",res.data.role);
            localStorage.setItem(
                "must_change_password",
                res.data.must_change_password
            );

            window.location.reload();

        }
        catch{

            setError("Invalid username or password.");

        }

    };

    return(

        <div className="login-page">

            <div className="login-card">

                <h1>Double2Print ERP</h1>

                <p>
                    Printing Workflow Management
                </p>

                <form onSubmit={handleSubmit}>

                    {error && (
                        <div className="login-error">
                            {error}
                        </div>
                    )}

                    <label>Username</label>

                    <input
                        value={username}
                        onChange={(e)=>setUsername(e.target.value)}
                        placeholder="Enter username"
                    />

                    <label>Password</label>

                    <input
                        type="password"
                        value={password}
                        onChange={(e)=>setPassword(e.target.value)}
                        placeholder="Enter password"
                    />

                    <button type="submit">

                        Login

                    </button>

                </form>

            </div>

        </div>

    );

}

export default Login;