from rest_framework import serializers
from core.models import Product, ProductProperty,ProductMaterial


class ProductPropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductProperty
        fields = ["id","product", "name", "field_type", "options"]

class ProductMaterialSerializer(serializers.ModelSerializer):
    variant = serializers.IntegerField(source="material_variant.id", read_only=True)
    material_name = serializers.CharField(source="material_variant.material.name", read_only=True)
    variant_name = serializers.CharField(source="material_variant.name", read_only=True)

    class Meta:
        model = ProductMaterial
        fields = [
            "id",
            "variant",
            "material_name",
            "variant_name",
            "default_quantity",
        ]

class ProductPropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductProperty
        fields = ["id", "product", "name", "field_type", "options"]


class ProductSerializer(serializers.ModelSerializer):

    properties = ProductPropertySerializer(
        source="productproperty_set",
        many=True,
        read_only=True
    )

    default_workflow_name = serializers.CharField(
        source="default_workflow.name",
        read_only=True
    )

    default_materials = ProductMaterialSerializer(
        source="productmaterial_set",
        many=True,
        read_only=True
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "wholesale_price",
            "retail_price",
            "default_workflow",
            "default_workflow_name",
            "is_active",
            "properties",
            "default_materials",
        ]