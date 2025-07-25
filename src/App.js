import React, { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// Backend API এর বেস URL
const API_BASE_URL = 'https://khichuri-backend-api.onrender.com/api';

// অ্যাডমিন ক্রেডেনশিয়ালস
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password123';

// টাইমস্ট্যাম্প ফরম্যাট করার জন্য হেল্পার ফাংশন
const formatTimestamp = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('bn-BD', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch (e) {
        console.error("Invalid date string:", isoString, e);
        return 'Invalid Date';
    }
};

// প্রধান App কম্পোনেন্ট
const App = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [newOrderCount, setNewOrderCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [products, setProducts] = useState([]);
    const [messages, setMessages] = useState([]);
    const [notification, setNotification] = useState('');
    const [showNotification, setShowNotification] = useState(false);
    const [notificationType, setNotificationType] = useState('info');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmAction, setConfirmAction] = useState(() => () => {});

    const showNotificationMessage = useCallback((msg, type = 'info') => {
        setNotification(msg);
        setNotificationType(type);
        setShowNotification(true);
        setTimeout(() => {
            setShowNotification(false);
        }, 4000);
    }, []);

    const fetchData = useCallback(async (url, setter, errorMessage) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                let parsedError = { message: 'Unknown error' };
                try {
                    parsedError = JSON.parse(errorText);
                } catch (parseError) {
                    parsedError.message = errorText;
                }
                throw new Error(`HTTP error! status: ${response.status}. Message: ${parsedError.message || 'Unknown error'}`);
            }
            const data = await response.json();
            setter(data);
        } catch (err) {
            console.error(`Error fetching ${url}:`, err);
            setError(errorMessage);
            showNotificationMessage(`এরর: ${errorMessage} (${err.message})`, "error");
        } finally {
            setLoading(false);
        }
    }, [showNotificationMessage]);

    const notificationColors = {
        info: 'bg-blue-600',
        success: 'bg-green-600',
        error: 'bg-red-600',
    };

    const fetchOrders = useCallback(() => 
        fetchData(`${API_BASE_URL}/orders`, (newOrders) => {
            console.log('All orders data:', JSON.parse(JSON.stringify(newOrders)));
            
            setOrders(prevOrders => {
                if (!prevOrders || prevOrders.length === 0) {
                    return newOrders;
                }
                
                // Find new orders
                const prevOrderIds = new Set(prevOrders.map(order => order._id));
                const addedOrders = newOrders.filter(order => !prevOrderIds.has(order._id));
                
                // If there are new orders
                if (addedOrders.length > 0) {
                    // Update new order count
                    setNewOrderCount(prev => prev + addedOrders.length);
                    
                    // Show desktop notification if browser supports it
                    if (Notification.permission === 'granted') {
                        addedOrders.forEach(order => {
                            const customerName = order.customerName || order.name || 'নতুন গ্রাহক';
                            new Notification('নতুন অর্ডার!', {
                                body: `${customerName} - ${order.phone || ''}`,
                                icon: '/logo192.png', // Make sure you have this in your public folder
                                vibrate: [200, 100, 200]
                            });
                        });
                    }
                    
                    // Show in-app notification
                    if (addedOrders.length === 1) {
                        const customerName = addedOrders[0].customerName || 
                                          addedOrders[0].name || 
                                          'নতুন গ্রাহক';
                        showNotificationMessage(`নতুন অর্ডার: ${customerName}`, 'success');
                    } else {
                        showNotificationMessage(`${addedOrders.length} টি নতুন অর্ডার এসেছে`, 'success');
                    }
                    
                    // Play notification sound
                    try {
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
                        audio.play().catch(e => console.log('Audio play failed:', e));
                    } catch (e) {
                        console.error('Error playing sound:', e);
                    }
                }
                
                return newOrders;
            });
            
        }, "অর্ডার লোড করতে সমস্যা হয়েছে।"), 
    [fetchData, showNotificationMessage]);
    const fetchProducts = useCallback(() => fetchData(`${API_BASE_URL}/products`, setProducts, "প্রোডাক্ট লোড করতে সমস্যা হয়েছে।"), [fetchData]);
    const fetchMessages = useCallback(() => fetchData(`${API_BASE_URL}/messages`, setMessages, "মেসেজ লোড করতে সমস্যা হয়েছে।"), [fetchData]);

    useEffect(() => {
        if (isLoggedIn) {
            fetchOrders();
            fetchProducts();
            fetchMessages();
            const orderIntervalId = setInterval(fetchOrders, 30000);
            const messageIntervalId = setInterval(fetchMessages, 60000);
            return () => {
                clearInterval(orderIntervalId);
                clearInterval(messageIntervalId);
            };
        }
    }, [isLoggedIn, fetchOrders, fetchProducts, fetchMessages]);

    const handleLogin = (event) => {
        event.preventDefault();
        const username = event.target.username.value;
        const password = event.target.password.value;
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            setIsLoggedIn(true);
            showNotificationMessage("লগইন সফল হয়েছে!", "success");
        } else {
            showNotificationMessage("ভুল ব্যবহারকারীর নাম বা পাসওয়ার্ড।", "error");
        }
    };

    const handleOrderStatusChange = async (orderId, newStatus) => {
        if (!orderId) {
            showNotificationMessage("অর্ডার আইডি পাওয়া যায়নি। আপডেট করা সম্ভব নয়।", "error");
            return;
        }
        setLoading(true);
        setError(null);
        const orderToUpdate = orders.find(o => o._id === orderId);
        if (!orderToUpdate) {
            showNotificationMessage(`অর্ডার ${orderId} খুঁজে পাওয়া যায়নি।`, "error");
            setLoading(false);
            return;
        }
        const updatedOrder = { ...orderToUpdate, status: newStatus };
        try {
            const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedOrder),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. Message: ${errorText}`);
            }
            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order._id === orderId ? { ...order, status: newStatus } : order
                )
            );
            showNotificationMessage(`অর্ডার ${orderId.substring(0, 8)}... এর স্টেটাস আপডেট করা হয়েছে।`, "success");
        } catch (err) {
            showNotificationMessage("অর্ডার স্টেটাস আপডেট করতে সমস্যা হয়েছে।", "error");
            fetchOrders();
        } finally {
            setLoading(false);
        }
    };

    const openAddProductModal = () => {
        setCurrentProduct(null);
        setIsProductModalOpen(true);
    };

    const openEditProductModal = (product) => {
        setCurrentProduct(product);
        setIsProductModalOpen(true);
    };

    const closeProductModal = () => {
        setIsProductModalOpen(false);
        setCurrentProduct(null);
    };

    const handleSaveProduct = async (productData) => {
        setLoading(true);
        setError(null);
        try {
            const idToUse = productData._id;
            const url = idToUse ? `${API_BASE_URL}/products/${idToUse}` : `${API_BASE_URL}/products`;
            const method = idToUse ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}. Message: ${errorText}`);
            }
            fetchProducts();
            closeProductModal();
            showNotificationMessage(`প্রোডাক্ট সফলভাবে ${idToUse ? 'এডিট' : 'যোগ'} করা হয়েছে।`, "success");
        } catch (err) {
            showNotificationMessage("প্রোডাক্ট সংরক্ষণ করতে সমস্যা হয়েছে।", "error");
        } finally {
            setLoading(false);
        }
    };
    
    const handleDeleteProduct = (productId) => {
        setConfirmMessage(`আপনি কি প্রোডাক্ট আইডি ${productId} মুছে ফেলতে নিশ্চিত?`);
        setConfirmAction(() => async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}. Message: ${errorText}`);
                }
                setProducts(prevProducts => prevProducts.filter(product => (product.id || product._id) !== productId));
                showNotificationMessage(`প্রোডাক্ট আইডি ${productId} মুছে ফেলা হয়েছে।`, "success");
            } catch (err) {
                showNotificationMessage("প্রোডাক্ট মুছে ফেলতে সমস্যা হয়েছে।", "error");
            } finally {
                setIsConfirmModalOpen(false);
                setLoading(false);
            }
        });
        setIsConfirmModalOpen(true);
    };

    // --- রিপোর্ট ডেটা ক্যালকুলেশন ---
    const totalOrders = orders.length;
    const totalProducts = products.length;
    const totalMessages = messages.length;
    const totalSales = orders
        .filter(order => order.status === 'সম্পন্ন')
        .reduce((sum, order) => sum + (order.total || 0), 0);

    const getChartData = useCallback(() => {
        const salesByDate = {};
        const today = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        last7Days.forEach(date => {
            salesByDate[date] = 0;
        });

        orders
            .filter(order => order.status === 'সম্পন্ন' && order.createdAt)
            .forEach(order => {
                try {
                    const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
                    if (salesByDate.hasOwnProperty(orderDate)) {
                        salesByDate[orderDate] += order.total;
                    }
                } catch (e) {
                    console.error("Invalid order date for chart:", order.createdAt);
                }
            });

        return {
            labels: Object.keys(salesByDate).map(date => new Date(date).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' })),
            datasets: [
                {
                    label: 'দৈনিক বিক্রি (টাকা)',
                    data: Object.values(salesByDate),
                    backgroundColor: 'rgba(251, 191, 36, 0.6)',
                    borderColor: 'rgba(251, 191, 36, 1)',
                    borderWidth: 1,
                    borderRadius: 5,
                    hoverBackgroundColor: 'rgba(251, 191, 36, 0.8)',
                    hoverBorderColor: 'rgba(251, 191, 36, 1)',
                },
            ],
        };
    }, [orders]);

    const chartData = getChartData();

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            title: {
                display: true,
                text: 'গত ৭ দিনের বিক্রির রিপোর্ট',
                font: { size: 18, weight: 'bold' },
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('bn-BD', { style: 'currency', currency: 'BDT' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return '৳' + new Intl.NumberFormat('bn-BD').format(value);
                    }
                }
            }
        }
    };

    // --- Header কম্পোনেন্ট ---
    const Header = () => (
        <header className="bg-gradient-to-r from-green-400 to-green-600 p-4 shadow-xl sticky top-0 z-50">
            <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">খিচুড়ি ঘর - অ্যাডমিন প্যানেল</h1>
                <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setShowNotifications(!showNotifications);
                                        setNewOrderCount(0); // Reset counter when clicking the bell
                                    }}
                                    className="p-2 text-white hover:bg-green-600 rounded-full transition-colors duration-200 relative"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    
                                    {/* Notification Badge - Shows count of pending orders */}
                                    {(() => {
                                        const pendingOrders = orders.filter(o => o.status === 'পেন্ডিং' || o.status === 'pending');
                                        console.log('Pending orders:', pendingOrders);
                                        return pendingOrders.length > 0 ? (
                                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold h-5 w-5 flex items-center justify-center rounded-full">
                                                {pendingOrders.length}
                                            </span>
                                        ) : null;
                                    })()}
                                </button>
                            </div>
                            
                            {/* Notification Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-96 bg-white rounded-md shadow-lg overflow-hidden z-50">
                                    <div className="p-4 border-b border-gray-200 bg-green-600">
                                        <h3 className="text-lg font-medium text-white">নতুন অর্ডার সমূহ</h3>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto">
                                        {(() => {
                                            if (orders.length === 0) {
                                                return (
                                                    <div className="p-4 text-center text-gray-500">
                                                        কোনো নতুন অর্ডার পাওয়া যায়নি
                                                    </div>
                                                );
                                            }

                                            // Sort orders by creation date (newest first) and take first 10
                                            const sortedOrders = [...orders]
                                                .sort((a, b) => {
                                                    const dateA = new Date(a.createdAt || 0);
                                                    const dateB = new Date(b.createdAt || 0);
                                                    return dateB - dateA; // Newest first
                                                })
                                                .slice(0, 10);

                                            return sortedOrders.map((order, index) => {
                                                let customerData = {};
                                                try {
                                                    customerData = order.customerData ? 
                                                        (typeof order.customerData === 'string' ? 
                                                            JSON.parse(order.customerData) : order.customerData) : 
                                                        {};
                                                } catch (e) {
                                                    console.error('Error parsing customer data:', e);
                                                }
                                                
                                                return (
                                                    <div key={order._id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                                                        <div className="flex items-start">
                                                            <div className="flex-shrink-0 w-8 text-gray-500 font-bold">
                                                                {index + 1}.
                                                            </div>
                                                            <div className="ml-2 flex-1">
                                                                <p className="text-sm font-medium text-gray-900 flex justify-between">
                                                                    <span>অর্ডার # {order._id?.substring(0, 6) || 'N/A'}</span>
                                                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                                                        order.status === 'pending' || order.status === 'পেন্ডিং' ? 
                                                                        'bg-yellow-100 text-yellow-800' : 
                                                                        'bg-green-100 text-green-800'
                                                                    }`}>
                                                                        {order.status === 'pending' || order.status === 'পেন্ডিং' ? 'পেন্ডিং' : (order.status || 'N/A')}
                                                                    </span>
                                                                </p>
                                                                <p className="text-sm text-gray-700 mt-1">
                                                                    {customerData?.name || 'নামবিহীন গ্রাহক'}
                                                                </p>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    {customerData?.phone || 'ফোন নং নেই'}
                                                                </p>
                                                                <p className="text-xs text-gray-400 mt-1">
                                                                    {order.createdAt ? new Date(order.createdAt).toLocaleString('bn-BD') : 'তারিখ পাওয়া যায়নি'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 text-center border-t border-gray-200">
                                        <button 
                                            onClick={() => {
                                                setActiveTab('orders');
                                                setShowNotifications(false);
                                            }} 
                                            className="text-sm font-medium text-green-600 hover:text-green-500 px-4 py-1 rounded-md hover:bg-green-50"
                                        >
                                            সব অর্ডার দেখুন
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    <button onClick={() => setIsLoggedIn(false)} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition duration-300">লগ আউট</button>
                </div>
            </div>
        </header>
    );

    // --- Footer কম্পোনেন্ট ---
    const Footer = () => (
        <footer className="bg-gray-800 text-white p-4 text-center">
            <p>&copy; {new Date().getFullYear()} খিচুড়ি ঘর। সর্বস্বত্ব সংরক্ষিত।</p>
        </footer>
    );

    // --- Product Modal কম্পোনেন্ট ---
    const ProductModal = ({ isOpen, onClose, onSave, product }) => {
        const [formData, setFormData] = useState({ name: '', price: '', description: '', image: '', discount: 0, recipe: '' });

        useEffect(() => {
            if (product) {
                setFormData({ name: product.name, price: product.price, description: product.description, image: product.image, discount: product.discount || 0, recipe: product.recipe || '' });
            } else {
                setFormData({ name: '', price: '', description: '', image: '', discount: 0, recipe: '' });
            }
        }, [product]);

        if (!isOpen) return null;

        const handleChange = (e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        const handleSubmit = (e) => {
            e.preventDefault();
            onSave({
                ...product,
                ...formData,
                price: parseFloat(formData.price) || 0,
                discount: parseFloat(formData.discount) || 0
            });
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                    <h2 className="text-2xl font-bold mb-6">{product ? 'প্রোডাক্ট এডিট করুন' : 'নতুন প্রোডাক্ট যোগ করুন'}</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-gray-700">নাম</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700">দাম</label>
                            <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700">ডিসকাউন্ট (%)</label>
                            <input type="number" name="discount" value={formData.discount} onChange={handleChange} className="w-full p-2 border rounded" min="0" max="100" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700">রেসিপি</label>
                            <textarea name="recipe" value={formData.recipe} onChange={handleChange} className="w-full p-2 border rounded h-32"></textarea>
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-700">বিবরণ</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} className="w-full p-2 border rounded"></textarea>
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700">ছবির URL</label>
                            <input type="text" name="image" value={formData.image} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"> বাতিল </button>
                            <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"> সংরক্ষণ করুন </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // --- নিশ্চিতকরণ মডেল কম্পোনেন্ট ---
    const ConfirmModal = ({ isOpen, message, onConfirm, onCancel }) => {
        if (!isOpen) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
                <div className="bg-white p-8 rounded-lg shadow-xl text-center">
                    <p className="text-lg mb-6">{message}</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={onCancel} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded">না</button>
                        <button onClick={onConfirm} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded">হ্যাঁ</button>
                    </div>
                </div>
            </div>
        );
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
                    <h2 className="text-2xl font-bold text-center mb-6">অ্যাডমিন লগইন</h2>
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label className="block text-gray-700">ব্যবহারকারীর নাম</label>
                            <input type="text" name="username" className="w-full p-2 border rounded" defaultValue={ADMIN_USERNAME} />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700">পাসওয়ার্ড</label>
                            <input type="password" name="password" className="w-full p-2 border rounded" defaultValue={ADMIN_PASSWORD} />
                        </div>
                        <button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">লগইন করুন</button>
                    </form>
                </div>
                {showNotification && (
                    <div className={`fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-lg ${notificationColors[notificationType]}`}>
                        {notification}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <Header />
            <div className="flex flex-1">
                <aside className="w-64 bg-gray-800 text-white p-4 h-screen sticky top-0 overflow-y-auto">
                    <nav>
                        <ul>
                            <li onClick={() => setActiveTab('orders')} className={`p-4 cursor-pointer rounded ${activeTab === 'orders' ? 'bg-green-500' : 'hover:bg-gray-700'}`}>অর্ডার</li>
                            <li onClick={() => setActiveTab('products')} className={`p-4 cursor-pointer rounded ${activeTab === 'products' ? 'bg-green-500' : 'hover:bg-gray-700'}`}>প্রোডাক্ট</li>
                            <li onClick={() => setActiveTab('reports')} className={`p-4 cursor-pointer rounded ${activeTab === 'reports' ? 'bg-green-500' : 'hover:bg-gray-700'}`}>রিপোর্ট</li>
                            <li onClick={() => setActiveTab('messages')} className={`p-4 cursor-pointer rounded ${activeTab === 'messages' ? 'bg-green-500' : 'hover:bg-gray-700'}`}>মেসেজ</li>
                        </ul>
                    </nav>
                </aside>
                <main className="flex-1 p-0 overflow-y-auto h-screen pr-4">
                    {activeTab === 'orders' && (
                        <div className="p-8">
                            <h2 className="text-3xl font-bold mb-6">অর্ডার ম্যানেজমেন্ট</h2>
                            {loading && <p>অর্ডার লোড হচ্ছে...</p>}
                            {error && <p className="text-red-500">{error}</p>}
                            <div className="bg-white shadow-md rounded-lg overflow-x-auto overflow-y-auto max-h-[70vh]">
                                <table className="min-w-full">
                                    <thead className="bg-gray-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="py-3 px-4 text-left">অর্ডার আইডি</th>
                                            <th className="py-3 px-4 text-left">গ্রাহকের নাম</th>
                                            <th className="py-3 px-4 text-left">ফোন নম্বর</th>
                                            <th className="py-3 px-4 text-left">ঠিকানা</th>
                                            <th className="py-3 px-4 text-left">আইটেম</th>
                                            <th className="py-3 px-4 text-left">মোট টাকা</th>
                                            <th className="py-3 px-4 text-left">পেমেন্ট পদ্ধতি</th>
                                            <th className="py-3 px-4 text-left">স্ট্যাটাস</th>
                                            <th className="py-3 px-4 text-left">সময়</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map(order => (
                                            <tr key={order._id} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4">{order._id.substring(0, 8)}...</td>
                                                <td className="py-3 px-4 font-medium">
                                                    {/* Try to get name from various possible locations */}
                                                    {(() => {
                                                        // Check direct fields first
                                                        if (order.customerName) return order.customerName;
                                                        if (order.name) return order.name;
                                                        
                                                        // Check customer/user objects
                                                        if (order.customer?.name) return order.customer.name;
                                                        if (order.user?.name) return order.user.name;
                                                        
                                                        // Check customerData (could be string or object)
                                                        try {
                                                            if (order.customerData) {
                                                                const customerData = typeof order.customerData === 'string' 
                                                                    ? JSON.parse(order.customerData) 
                                                                    : order.customerData;
                                                                if (customerData.name) return customerData.name;
                                                            }
                                                        } catch (e) {
                                                            console.error('Error parsing customerData:', e);
                                                        }
                                                        
                                                        // If we have an email but no name, use the email
                                                        if (order.email) return order.email.split('@')[0];
                                                        
                                                        // Fallback
                                                        return 'নাম পাওয়া যায়নি';
                                                    })()}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {order.phone || 
                                                     order.customer?.phone || 
                                                     order.user?.phone ||
                                                     (order.customerData ? (
                                                        typeof order.customerData === 'string' ? 
                                                            JSON.parse(order.customerData).phone : 
                                                            order.customerData.phone
                                                     ) : 'নম্বর নেই')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {order.address ||
                                                     (order.customerData ? (
                                                        typeof order.customerData === 'string' ? 
                                                            JSON.parse(order.customerData).address : 
                                                            order.customerData.address
                                                     ) : 'ঠিকানা নেই')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="space-y-1">
                                                        {order.items.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between">
                                                                <span>{item.name || item.productName || 'আইটেম ' + (idx + 1)}</span>
                                                                <span className="font-medium">x{item.quantity || item.qty || 1}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">৳{order.total}</td>
                                                <td className="py-3 px-4">
                                                    {order.paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি' : 
                                                     order.paymentMethod === 'bkash' ? 'বিকাশ' : 
                                                     order.paymentMethod === 'nagad' ? 'নগদ' : 
                                                     order.paymentMethod || 'N/A'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <select value={order.status} onChange={(e) => handleOrderStatusChange(order._id, e.target.value)} className="p-2 border rounded">
                                                        <option value="পেন্ডিং">পেন্ডিং</option>
                                                        <option value="প্রস্তুত হচ্ছে">প্রস্তুত হচ্ছে</option>
                                                        <option value="পাঠানো হয়েছে">পাঠানো হয়েছে</option>
                                                        <option value="সম্পন্ন">সম্পন্ন</option>
                                                        <option value="বাতিল">বাতিল</option>
                                                    </select>
                                                </td>
                                                <td className="py-3 px-4">{formatTimestamp(order.createdAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {activeTab === 'products' && (
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-3xl font-bold">প্রোডাক্ট ম্যানেজমেন্ট</h2>
                                <button onClick={openAddProductModal} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">নতুন প্রোডাক্ট যোগ করুন</button>
                            </div>
                            <div className="bg-white shadow-md rounded-lg overflow-x-auto overflow-y-auto max-h-[70vh]">
                                <table className="min-w-full">
                                    <thead className="bg-gray-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="py-3 px-4 text-left">ছবি</th>
                                            <th className="py-3 px-4 text-left">নাম</th>
                                            <th className="py-3 px-4 text-left">দাম</th>
                                            <th className="py-3 px-4 text-left">ডিসকাউন্ট</th>
                                            <th className="py-3 px-4 text-left">বিবরণ</th>
                                            <th className="py-3 px-4 text-left">অ্যাকশন</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map(product => (
                                            <tr key={product._id} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <img src={product.image} alt={product.name} className="w-16 h-16 rounded-md object-cover" onError={(e) => e.target.src = 'https://placehold.co/100x100/CCCCCC/000000?text=No+Image'} />
                                                </td>
                                                <td className="py-3 px-4">{product.name}</td>
                                                <td className="py-3 px-4">৳{product.price}</td>
                                                <td className="py-3 px-4">{product.discount || 0}%</td>
                                                <td className="py-3 px-4 max-w-xs truncate" title={product.description}>{product.description}</td>
                                                <td className="py-3 px-4">
                                                    <button onClick={() => openEditProductModal(product)} className="bg-blue-500 text-white py-1 px-3 rounded mr-2">এডিট</button>
                                                    <button onClick={() => handleDeleteProduct(product._id)} className="bg-red-500 text-white py-1 px-3 rounded">ডিলিট</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {/* --- রিপোর্ট ট্যাব --- */}
                    {activeTab === 'reports' && (
                        <div className="p-6 md:p-8 bg-gray-50 min-h-full">
                            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-2">রিপোর্ট ড্যাশবোর্ড</h2>
                            <p className="text-gray-600 mb-8">আপনার ব্যবসার পারফরম্যান্সের একটি ওভারভিউ দেখুন।</p>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                <div className="bg-gradient-to-br from-blue-400 to-blue-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
                                    <h3 className="text-lg font-semibold mb-2">মোট অর্ডার</h3>
                                    <p className="text-4xl font-bold">{totalOrders}</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-400 to-green-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
                                    <h3 className="text-lg font-semibold mb-2">মোট বিক্রি</h3>
                                    <p className="text-4xl font-bold">৳{totalSales.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-400 to-purple-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
                                    <h3 className="text-lg font-semibold mb-2">মোট প্রোডাক্ট</h3>
                                    <p className="text-4xl font-bold">{totalProducts}</p>
                                </div>
                                <div className="bg-gradient-to-br from-red-400 to-red-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
                                    <h3 className="text-lg font-semibold mb-2">মোট মেসেজ</h3>
                                    <p className="text-4xl font-bold">{totalMessages}</p>
                                </div>
                            </div>
                            {/* Sales Chart */}
                            <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg h-96">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-gray-500 text-lg">চার্ট লোড হচ্ছে...</p>
                                    </div>
                                ) : (
                                    <Bar options={chartOptions} data={chartData} />
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'messages' && (
                        <div className="p-8">
                            <h2 className="text-3xl font-bold mb-6">মেসেজ</h2>
                            <div className="bg-white shadow-md rounded-lg">
                                <ul>
                                    {messages.map(msg => (
                                        <li key={msg._id} className="p-4 border-b">
                                            <p><strong>নাম:</strong> {msg.name}</p>
                                            <p><strong>ইমেইল:</strong> {msg.email}</p>
                                            <p><strong>মেসেজ:</strong> {msg.message}</p>
                                            <p className="text-sm text-gray-500">{formatTimestamp(msg.createdAt)}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </main>
            </div>
            <Footer />
            {showNotification && (
                <div className={`fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-lg ${notificationColors[notificationType]}`}>
                    {notification}
                </div>
            )}
            <ProductModal isOpen={isProductModalOpen} onClose={closeProductModal} onSave={handleSaveProduct} product={currentProduct} />
            <ConfirmModal isOpen={isConfirmModalOpen} message={confirmMessage} onConfirm={confirmAction} onCancel={() => setIsConfirmModalOpen(false)} />
        </div>
    );
};

export default App;