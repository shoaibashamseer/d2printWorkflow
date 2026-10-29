from rest_framework import serializers

from core.models import (
    OrderItem,
    OrderFeatureValue,
    Product,
    OrderItemMaterial,
    RawMaterialVariant,
)


class OrderItemSerializer(serializers.Serializer):
    product = serializers.IntegerField()
    quantity = serializers.IntegerField()
    features = serializers.ListField(required=False, default=list)
    materials = serializers.ListField(required=False, default=list)

    def create(self, validated_data):
        order = self.context["order"]

        # -----------------------------------------
        # PRODUCT
        # -----------------------------------------

        product = Product.objects.get(
            pk=validated_data["product"]
        )

        # -----------------------------------------
        # AUTOMATIC WORKFLOW
        # -----------------------------------------

        workflow = product.default_workflow

        if not workflow:
            raise serializers.ValidationError({
                "product": (
                    f"Product '{product.name}' "
                    "does not have a default workflow."
                )
            })

        quantity = validated_data.get("quantity", 1)

        unit_price = (
            product.wholesale_price
            if order.customer.customer_type == "wholesale"
            else product.retail_price
        )

        # -----------------------------------------
        # CREATE ORDER ITEM
        # -----------------------------------------

        item = OrderItem.objects.create(
            order=order,
            product=product,
            workflow=workflow,
            quantity=quantity,
            product_name_at_order=product.name,
            product_description_at_order=product.description,
            customer_name_at_order=order.customer.name,
            quantity_at_order=quantity,
            unit_price_at_order=unit_price,
        )

        # -----------------------------------------
        # SAVE FEATURES
        # -----------------------------------------

        for f in validated_data.get("features", []):

            OrderFeatureValue.objects.create(
                order_item=item,
                feature_name=f["name"],
                value=f["value"]
            )

        # -----------------------------------------
        # SAVE MATERIALS
        # -----------------------------------------

        for m in validated_data.get("materials", []):

            variant = RawMaterialVariant.objects.get(
                pk=m["variant"]
            )

            used_qty = float(
                m["quantity_used"]
            )

            if variant.stock < used_qty:

                raise serializers.ValidationError({
                    "materials": (
                        f"Not enough stock for "
                        f"{variant.name}."
                    )
                })

            OrderItemMaterial.objects.create(
                order_item=item,
                material_variant=variant,
                quantity_used=used_qty
            )

            # Reduce stock
            variant.stock -= used_qty
            variant.save(
                update_fields=["stock"]
            )

        return item
