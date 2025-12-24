import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from './providers/LanguageContext';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function DataRequestForm() {
    const { language } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        type: '',
        details: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.email || !formData.name || !formData.type) {
            toast.error(language === 'he' ? 'אנא מלא את כל שדות החובה' : 'Please fill all required fields');
            return;
        }

        setLoading(true);
        try {
            await base44.functions.invoke('submitDataRequest', {
                requester_email: formData.email,
                requester_name: formData.name,
                request_type: formData.type,
                request_details: formData.details
            });
            toast.success(language === 'he' ? 'הבקשה נשלחה בהצלחה. בדוק את המייל לאימות.' : 'Request submitted. Check email for verification.');
            setFormData({ email: '', name: '', type: '', details: '' });
        } catch (error) {
            console.error(error);
            toast.error(language === 'he' ? 'שגיאה בשליחת הבקשה' : 'Error submitting request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {language === 'he' ? 'שם מלא' : 'Full Name'}
                        </label>
                        <Input 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            placeholder={language === 'he' ? 'ישראל ישראלי' : 'John Doe'} 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {language === 'he' ? 'אימייל' : 'Email'}
                        </label>
                        <Input 
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            placeholder="user@example.com" 
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {language === 'he' ? 'סוג בקשה' : 'Request Type'}
                    </label>
                    <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                        <SelectTrigger>
                            <SelectValue placeholder={language === 'he' ? 'בחר סוג' : 'Select Type'} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="access">{language === 'he' ? 'גישה למידע (Access)' : 'Access Data'}</SelectItem>
                            <SelectItem value="rectification">{language === 'he' ? 'תיקון מידע (Rectification)' : 'Rectify Data'}</SelectItem>
                            <SelectItem value="erasure">{language === 'he' ? 'מחיקת מידע (Erasure)' : 'Delete Data'}</SelectItem>
                            <SelectItem value="portability">{language === 'he' ? 'ניוד מידע (Portability)' : 'Data Portability'}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {language === 'he' ? 'פרטים נוספים' : 'Additional Details'}
                    </label>
                    <Textarea 
                        value={formData.details}
                        onChange={(e) => setFormData({...formData, details: e.target.value})}
                        placeholder={language === 'he' ? 'פרט את בקשתך...' : 'Please describe your request...'} 
                        className="h-24 resize-none"
                    />
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-[#114B5F] hover:bg-[#0d3a4a] text-white">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'he' ? 'שלח בקשה' : 'Submit Request')}
                </Button>
            </form>
        </div>
    );
}