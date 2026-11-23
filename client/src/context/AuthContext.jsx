import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check whether the user already has a valid session.
    useEffect(() => {
        let active = true;

        const checkAuth = async () => {
            try {
                const response = await api.get("/auth/me");

                if (active) {
                    setUser(response.data.user);
                }
            } catch {
                if (active) {
                    setUser(null);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        checkAuth();

        return () => {
            active = false;
        };
    }, []);

    // Login
    const login = async (credentials) => {
        const response = await api.post(
            "/auth/login",
            credentials
        );

        setUser(response.data.user);

        return response.data;
    };

    // Registration
    const register = async (userData) => {
        const response = await api.post(
            "/auth/register",
            userData
        );

        setUser(response.data.user);

        return response.data;
    };

    // Logout
    const logout = async () => {
        try {
            await api.post("/auth/logout");
        } finally {
            setUser(null);
        }
    };

    const value = {
        user,
        loading,
        login,
        register,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }

    return context;
};