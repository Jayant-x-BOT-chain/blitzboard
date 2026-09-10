import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import './ImageUpload.css';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string | null) => void;
    uploading?: boolean;
    onUpload?: (file: File) => Promise<string>;
}

export function ImageUpload({ value, onChange, uploading = false, onUpload }: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            await processFile(file);
        }
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    const processFile = async (file: File) => {
        setError(null);

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        if (onUpload) {
            try {
                setIsUploading(true);
                const url = await onUpload(file);
                onChange(url);
            } catch (err) {
                setError('Failed to upload image');
                console.error('Upload error:', err);
            } finally {
                setIsUploading(false);
            }
        } else {
            // Just create a local preview URL
            const previewUrl = URL.createObjectURL(file);
            onChange(previewUrl);
        }
    };

    const handleRemove = () => {
        onChange(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const isLoading = uploading || isUploading;

    return (
        <div className="image-upload">
            {value ? (
                <div className="image-preview">
                    <img src={value} alt="Cover preview" />
                    <button
                        type="button"
                        className="remove-btn"
                        onClick={handleRemove}
                        disabled={isLoading}
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <div
                    className={`upload-zone ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    {isLoading ? (
                        <div className="upload-loading">
                            <div className="spinner" />
                            <p>Uploading...</p>
                        </div>
                    ) : (
                        <>
                            <div className="upload-icon">
                                {isDragging ? <ImageIcon size={32} /> : <Upload size={32} />}
                            </div>
                            <p className="upload-text">
                                {isDragging ? 'Drop your image here' : 'Click or drag to upload cover image'}
                            </p>
                            <p className="upload-hint">PNG, JPG up to 5MB</p>
                        </>
                    )}
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            {error && <p className="upload-error">{error}</p>}
        </div>
    );
}
