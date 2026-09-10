import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { EventForm } from '../components/EventForm';
import { useAuth } from '../hooks/useAuth';
import { createEvent, uploadCoverImage, type CreateEventInput } from '../lib/eventService';
import './CreateEventPage.css';

export function CreateEventPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = async (file: File): Promise<string> => {
        if (!user?.id) {
            throw new Error('Not authenticated');
        }
        return uploadCoverImage(file, user.id);
    };

    const handleSubmit = async (data: CreateEventInput, isDraft: boolean) => {
        if (!user?.id) {
            setError('You must be logged in to create an event');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const event = await createEvent(user.id, data);

            if (isDraft) {
                // Saved as draft - go to dashboard
                navigate('/dashboard/host');
            } else {
                // Submit event - go to submit flow
                navigate(`/event/${event.id}/submit`);
            }
        } catch (err) {
            console.error('Error creating event:', err);
            setError('Failed to save event. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="create-event-page">
            <div className="container">
                <button className="back-btn" onClick={() => navigate('/dashboard/host')}>
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </button>

                <div className="page-header">
                    <h1>Create New Event</h1>
                    <p>Set up your hackathon, competition, or showcase</p>
                </div>

                {error && (
                    <div className="error-banner">
                        {error}
                    </div>
                )}

                <EventForm
                    onSubmit={handleSubmit}
                    onImageUpload={handleImageUpload}
                    isSubmitting={isSubmitting}
                />
            </div>
        </div>
    );
}
