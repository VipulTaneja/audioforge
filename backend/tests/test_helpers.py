import pytest
from app.workers.helpers import (
    DEFAULT_DEMUCS_MODEL,
    SUPPORTED_DEMUCS_MODELS,
    SUPPORTED_STEM_MODES,
    STEM_TYPES,
    validate_demucs_model,
    validate_stem_mode,
    validate_model_for_stem_mode,
)


class TestDemucsModels:
    """Test Demucs model validation."""

    def test_default_model(self):
        """Test default model is set correctly."""
        assert DEFAULT_DEMUCS_MODEL == "htdemucs"

    def test_supported_models(self):
        """Test all supported models are defined."""
        assert "htdemucs" in SUPPORTED_DEMUCS_MODELS
        assert "htdemucs_ft" in SUPPORTED_DEMUCS_MODELS
        assert "mdx" in SUPPORTED_DEMUCS_MODELS
        assert "mdx_extra" in SUPPORTED_DEMUCS_MODELS
        assert len(SUPPORTED_DEMUCS_MODELS) == 4

    def test_validate_demucs_model_valid(self):
        """Test validation passes for valid models."""
        assert validate_demucs_model("htdemucs") is True
        assert validate_demucs_model("htdemucs_ft") is True
        assert validate_demucs_model("mdx") is True

    def test_validate_demucs_model_invalid(self):
        """Test validation fails for invalid models."""
        assert validate_demucs_model("invalid_model") is False
        assert validate_demucs_model("") is False


class TestStemModes:
    """Test stem mode validation."""

    def test_supported_stem_modes(self):
        """Test all supported stem modes are defined."""
        assert "four_stem" in SUPPORTED_STEM_MODES
        assert "two_stem_vocals" in SUPPORTED_STEM_MODES

    def test_validate_stem_mode_valid(self):
        """Test validation passes for valid stem modes."""
        assert validate_stem_mode("four_stem") is True
        assert validate_stem_mode("two_stem_vocals") is True

    def test_validate_stem_mode_invalid(self):
        """Test validation fails for invalid stem modes."""
        assert validate_stem_mode("invalid_mode") is False
        assert validate_stem_mode("") is False


class TestModelStemModeValidation:
    """Test model and stem mode compatibility validation."""

    def test_four_stem_with_valid_models(self):
        """Test four_stem mode works with htdemucs and htdemucs_ft."""
        is_valid, _ = validate_model_for_stem_mode("htdemucs", "four_stem")
        assert is_valid is True
        
        is_valid, _ = validate_model_for_stem_mode("htdemucs_ft", "four_stem")
        assert is_valid is True

    def test_four_stem_with_invalid_models(self):
        """Test four_stem mode fails with mdx models."""
        is_valid, error = validate_model_for_stem_mode("mdx", "four_stem")
        assert is_valid is False
        assert "only supports reliable vocals/accompaniment" in error

    def test_two_stem_with_valid_models(self):
        """Test two_stem_vocals works with valid models."""
        is_valid, _ = validate_model_for_stem_mode("htdemucs", "two_stem_vocals")
        assert is_valid is True
        
        is_valid, _ = validate_model_for_stem_mode("mdx", "two_stem_vocals")
        assert is_valid is True

    def test_two_stem_with_invalid_models(self):
        """Test two_stem_vocals validation."""
        is_valid, error = validate_model_for_stem_mode("invalid_model", "two_stem_vocals")
        assert is_valid is False
        assert "Unsupported model" in error


class TestStemTypes:
    """Test stem types constants."""

    def test_stem_types_list(self):
        """Test stem types are defined correctly."""
        assert STEM_TYPES == ["vocals", "drums", "bass", "other", "accompaniment"]
        assert len(STEM_TYPES) == 5
