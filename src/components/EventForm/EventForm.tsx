import { useState, type FormEvent } from 'react';
import { ImageUpload } from '../ImageUpload';
import { Calendar, Clock, Users, Globe, FileText } from 'lucide-react';
import type { EventType, SubmissionType, Visibility, CreateEventInput } from '../../lib/eventService';
import './EventForm.css';

interface EventFormProps {
    initialData?: Partial<CreateEventInput>;
    onSubmit: (data: CreateEventInput, isDraft: boolean) => Promise<void>;
    onImageUpload?: (file: File) => Promise<string>;
    isSubmitting?: boolean;
}

export function EventForm({ initialData, onSubmit, onImageUpload, isSubmitting = false }: EventFormProps) {
    const [formData, setFormData] = useState<CreateEventInput>({
        name: initialData?.name || '',
        description: initialData?.description || '',
        event_type: initialData?.event_type || 'hackathon',
        start_date: initialData?.start_date || '',
        end_date: initialData?.end_date || '',
        submission_type: initialData?.submission_type || 'individual',
        visibility: initialData?.visibility || 'public',
        cover_image_url: initialData?.cover_image_url || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Event name is required';
        }

        if (!formData.start_date) {
            newErrors.start_date = 'Start date is required';
        }

        if (!formData.end_date) {
            newErrors.end_date = 'End date is required';
        }

        if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
            newErrors.end_date = 'End date must be after start date';
        }

        if (!formData.cover_image_url) {
            newErrors.cover_image_url = 'Cover image is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent, isDraft: boolean) => {
        e.preventDefault();

        if (!isDraft && !validate()) {
            return;
        }

        await onSubmit(formData, isDraft);
    };

    const handleChange = (field: keyof CreateEventInput, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    return (
        <form className="event-form" onSubmit={(e) => handleSubmit(e, false)}>
            {/* Cover Image */}
            <div className="form-section">
                <label className="form-label">
                    Cover Image <span className="required">*</span>
                </label>
                <ImageUpload
                    value={formData.cover_image_url}
                    onChange={(url) => handleChange('cover_image_url', url || '')}
                    onUpload={onImageUpload}
                />
                {errors.cover_image_url && <p className="form-error">{errors.cover_image_url}</p>}
            </div>

            {/* Event Name */}
            <div className="form-section">
                <label className="form-label" htmlFor="name">
                    <FileText size={18} />
                    Event Name <span className="required">*</span>
                </label>
                <input
                    id="name"
                    type="text"
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    placeholder="e.g., Botchain Hackathon 2024"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                />
                {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            {/* Description */}
            <div className="form-section">
                <label className="form-label" htmlFor="description">
                    Description
                </label>
                <textarea
                    id="description"
                    className="form-textarea"
                    placeholder="Tell participants what your event is about..."
                    rows={4}
                    value={formData.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                />
            </div>

            {/* Event Type */}
            <div className="form-section">
                <label className="form-label">Event Type</label>
                <div className="form-select-group">
                    {(['hackathon', 'competition', 'showcase', 'other'] as EventType[]).map((type) => (
                        <button
                            key={type}
                            type="button"
                            className={`form-select-btn ${formData.event_type === type ? 'active' : ''}`}
                            onClick={() => handleChange('event_type', type)}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dates */}
            <div className="form-row">
                <div className="form-section">
                    <label className="form-label" htmlFor="start_date">
                        <Calendar size={18} />
                        Start Date <span className="required">*</span>
                    </label>
                    <input
                        id="start_date"
                        type="datetime-local"
                        className={`form-input ${errors.start_date ? 'error' : ''}`}
                        value={formData.start_date}
                        onChange={(e) => handleChange('start_date', e.target.value)}
                    />
                    {errors.start_date && <p className="form-error">{errors.start_date}</p>}
                </div>

                <div className="form-section">
                    <label className="form-label" htmlFor="end_date">
                        <Clock size={18} />
                        End Date <span className="required">*</span>
                    </label>
                    <input
                        id="end_date"
                        type="datetime-local"
                        className={`form-input ${errors.end_date ? 'error' : ''}`}
                        value={formData.end_date}
                        onChange={(e) => handleChange('end_date', e.target.value)}
                    />
                    {errors.end_date && <p className="form-error">{errors.end_date}</p>}
                </div>
            </div>

            {/* Submission Type */}
            <div className="form-section">
                <label className="form-label">
                    <Users size={18} />
                    Submission Type
                </label>
                <div className="form-select-group">
                    {(['individual', 'team', 'both'] as SubmissionType[]).map((type) => (
                        <button
                            key={type}
                            type="button"
                            className={`form-select-btn ${formData.submission_type === type ? 'active' : ''}`}
                            onClick={() => handleChange('submission_type', type)}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Visibility */}
            <div className="form-section">
                <label className="form-label">
                    <Globe size={18} />
                    Visibility
                </label>
                <div className="form-select-group">
                    {(['public', 'private', 'invite-only'] as Visibility[]).map((vis) => (
                        <button
                            key={vis}
                            type="button"
                            className={`form-select-btn ${formData.visibility === vis ? 'active' : ''}`}
                            onClick={() => handleChange('visibility', vis)}
                        >
                            {vis.charAt(0).toUpperCase() + vis.slice(1).replace('-', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="form-actions">
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={isSubmitting}
                >
                    Save Draft
                </button>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Processing...' : 'Submit Event'}
                </button>
            </div>
        </form>
    );
}
